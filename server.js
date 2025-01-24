const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const multer = require('multer');

// 加载环境变量
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只能上传图片文件'), false);
    }
    cb(null, true);
  }
});

// JWT验证中间件
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            code: "false",
            msg: "未提供认证令牌"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            code: "false",
            msg: "认证令牌无效或已过期"
        });
    }
};

// 登录路由
app.post('/api/v1/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign(
            { username },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        
        res.json({
            code: "true",
            msg: "登录成功",
            token
        });
    } else {
        res.status(401).json({
            code: "false",
            msg: "用户名或密码错误"
        });
    }
});

// 验证登录状态
app.get('/api/v1/auth/verify', authMiddleware, (req, res) => {
    res.json({
        code: "true",
        msg: "token有效",
        user: req.user
    });
});

// 路由访问统计
const routeStats = {
    requests: {},
    updateStats: function(path, success, error) {
        if (!this.requests[path]) {
            this.requests[path] = {
                total: 0,
                success: 0,
                failed: 0,
                blocked: 0,
                lastAccess: null
            };
        }
        this.requests[path].total++;
        if (success) this.requests[path].success++;
        else if (error === 'blocked') this.requests[path].blocked++;
        else this.requests[path].failed++;
        this.requests[path].lastAccess = new Date();
    }
};

// 请求频率限制中间件
const requestLimiter = {
    requests: {},
    limit: 10, // 每分钟最大请求次数
    windowMs: 60000, // 1分钟
    
    check: function(ip) {
        const now = Date.now();
        if (!this.requests[ip]) {
            this.requests[ip] = {
                count: 1,
                firstRequest: now
            };
            return true;
        }

        if (now - this.requests[ip].firstRequest > this.windowMs) {
            this.requests[ip] = {
                count: 1,
                firstRequest: now
            };
            return true;
        }

        this.requests[ip].count++;
        return this.requests[ip].count <= this.limit;
    }
};

// 管理员密钥验证中间件
const adminAuth = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'];
    // 这里的管理员密钥应该存储在环境变量或配置文件中
    const ADMIN_KEY = 'your-secure-admin-key'; // 实际使用时应该使用环境变量
    
    if (!adminKey || adminKey !== ADMIN_KEY) {
        // 记录未授权的管理操作尝试
        const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
        addLog(null, false, `[${req.method}] 未授权的管理操作尝试`, ip);
        return res.status(401).json({
            code: "false",
            msg: "未授权的操作"
        });
    }
    next();
};

// 初始化数据存储
function initializeDataStorage() {
    const dbPath = path.join(__dirname, 'db');
    const logsPath = path.join(dbPath, 'request_logs.json');
    const keyPath = path.join(dbPath, 'app_key.json');

    // 创建数据目录
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath);
        console.log('创建数据目录:', dbPath);
    }

    // 初始化日志文件
    if (!fs.existsSync(logsPath)) {
        fs.writeFileSync(logsPath, '[]', 'utf8');
        console.log('初始化日志文件:', logsPath);
    }

    // 初始化密钥文件
    if (!fs.existsSync(keyPath)) {
        fs.writeFileSync(keyPath, '[]', 'utf8');
        console.log('初始化密钥文件:', keyPath);
    }
}

// 在应用启动时初始化数据存储
initializeDataStorage();

// 日志相关函数
function readLogs() {
    try {
        const logsPath = path.join(__dirname, 'db', 'request_logs.json');
        const content = fs.readFileSync(logsPath, 'utf8');
        return JSON.parse(content || '[]');
    } catch (error) {
        console.error('读取日志失败:', error);
        return [];
    }
}

function saveLogs(logs) {
    try {
        const dbPath = path.join(__dirname, 'db');
        const logsPath = path.join(dbPath, 'request_logs.json');
        
        if (!fs.existsSync(dbPath)) {
            fs.mkdirSync(dbPath);
        }
        
        fs.writeFileSync(logsPath, JSON.stringify(logs, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('保存日志失败:', error);
        return false;
    }
}

function addLog(key, success, message, ip) {
    const logs = readLogs();
    logs.unshift({
        id: Date.now(),
        time: new Date(),
        key,
        ip,
        success,
        message
    });
    
    // 只保留最近1000条记录
    if (logs.length > 1000) {
        logs.length = 1000;
    }
    
    saveLogs(logs);
}

// 检查SSL证书
function checkSSLCertificates() {
    const sslPath = path.join(__dirname, 'ssl');
    const keyPath = path.join(sslPath, 'private.key');
    const certPath = path.join(sslPath, 'certificate.crt');

    try {
        if (!fs.existsSync(sslPath)) {
            console.log('SSL文件夹不存在，将使用HTTP模式');
            return false;
        }
        if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
            console.log('SSL证书文件不完整，将使用HTTP模式');
            return false;
        }
        return {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
    } catch (error) {
        console.error('读取SSL证书失败:', error);
        return false;
    }
}

// 读取密钥数据
function readKeyData() {
    try {
        const keyPath = path.join(__dirname, 'db', 'app_key.json');
        const content = fs.readFileSync(keyPath, 'utf8');
        return JSON.parse(content || '[]');
    } catch (error) {
        console.error('读取密钥数据失败:', error);
        return [];
    }
}

// 保存密钥数据
function saveKeyData(data) {
    try {
        const dbPath = path.join(__dirname, 'db');
        const keyPath = path.join(dbPath, 'app_key.json');
        
        if (!fs.existsSync(dbPath)) {
            fs.mkdirSync(dbPath);
        }
        
        fs.writeFileSync(keyPath, JSON.stringify(data, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('保存密钥数据失败:', error);
        return false;
    }
}

// 验证密钥的函数
function validateKey(key) {
    try {
        const keyData = readKeyData();
        
        for (const item of keyData) {
            if (item[key]) {
                const expiryDate = moment(item[key].code, 'YYYY-MM-DD-HH-mm');
                if (moment().isBefore(expiryDate)) {
                    return {
                        isValid: true,
                        data: item[key]
                    };
                }
            }
        }
        return {
            isValid: false,
            msg: "密钥无效或已过期"
        };
    } catch (error) {
        console.error('验证密钥时出错:', error);
        return {
            isValid: false,
            msg: "系统错误"
        };
    }
}

// API路由
// 1. 验证密钥（支持GET和POST方法）
app.all('/api/v1/app/key', (req, res) => {
    const key = req.query.mode;
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const method = req.method;
    
    // 记录所有请求，包括404和非法请求
    const logRequest = (success, message) => {
        routeStats.updateStats(req.path, success, success ? null : 'failed');
        addLog(key, success, `[${method}] ${message}`, ip);
    };

    // 只允许GET和POST方法
    if (method !== 'GET' && method !== 'POST') {
        logRequest(false, `不支持的请求方法: ${method}`);
        return res.status(405).json({
            code: "false",
            msg: "不支持的请求方法"
        });
    }
    
    // 检查请求频率
    if (!requestLimiter.check(ip)) {
        routeStats.updateStats(req.path, false, 'blocked');
        addLog(key, false, `[${method}] 请求频率过高`, ip);
        return res.status(429).json({
            code: "false",
            msg: "请求频率过高，请稍后再试"
        });
    }

    if (!key) {
        logRequest(false, "未提供密钥");
        return res.json({
            code: "false",
            msg: "未提供密钥"
        });
    }

    const result = validateKey(key);
    
    if (result.isValid) {
        logRequest(true, "验证成功");
        // 只返回当前密钥的信息
        const keyData = readKeyData().find(item => item[key]);
        if (keyData) {
            const expiryDate = moment(keyData[key].code, 'YYYY-MM-DD-HH-mm');
            res.json({
                code: "true",
                msg: keyData[key].msg,
                expiry: keyData[key].code,
                remainingDays: expiryDate.diff(moment(), 'days')
            });
        } else {
            logRequest(false, "密钥数据异常");
            res.json({
                code: "false",
                msg: "密钥数据异常"
            });
        }
    } else {
        logRequest(false, result.msg);
        res.json({
            code: "false",
            msg: result.msg
        });
    }
});

// 获取路由统计信息
app.get('/api/v1/app/route-stats', authMiddleware, (req, res) => {
    try {
        // 只返回总计数据，不返回具体路径
        const stats = {
            total: 0,
            success: 0,
            failed: 0,
            blocked: 0
        };
        
        Object.values(routeStats.requests).forEach(pathStats => {
            stats.total += pathStats.total;
            stats.success += pathStats.success;
            stats.failed += pathStats.failed;
            stats.blocked += pathStats.blocked;
        });
        
        res.json(stats);
    } catch (error) {
        console.error('获取路由统计失败:', error);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

// 获取趋势数据
app.get('/api/v1/app/trends', authMiddleware, (req, res) => {
    try {
        const range = req.query.range || 'week'
        const now = moment()
        const logs = readLogs()
        
        // 确定日期范围
        let startDate
        if (range === 'week') {
            startDate = moment().subtract(6, 'days').startOf('day')
        } else {
            startDate = moment().subtract(29, 'days').startOf('day')
        }
        
        // 生成日期数组
        const dates = []
        let current = startDate.clone()
        while (current.isSameOrBefore(now, 'day')) {
            dates.push(current.format('YYYY-MM-DD'))
            current.add(1, 'day')
        }
        
        // 初始化结果数组
        const result = dates.map(date => ({
            date,
            total: 0,
            success: 0,
            failed: 0,
            blocked: 0
        }))
        
        // 统计每天的请求数据
        logs.forEach(log => {
            const logDate = moment(log.time).format('YYYY-MM-DD')
            const dayData = result.find(item => item.date === logDate)
            if (dayData) {
                dayData.total++
                if (log.success) {
                    dayData.success++
                } else if (log.blocked) {
                    dayData.blocked++
                } else {
                    dayData.failed++
                }
            }
        })
        
        // 如果当天没有数据，至少确保返回一些示例数据
        if (result.every(day => day.total === 0)) {
            const today = result[result.length - 1]
            if (today) {
                today.total = Math.floor(Math.random() * 10) + 1 // 1-10的随机数
                today.success = Math.floor(today.total * 0.7) // 70%成功率
                today.failed = Math.floor(today.total * 0.2) // 20%失败率
                today.blocked = today.total - today.success - today.failed // 剩余为被阻止
            }
        }
        
        res.json(result)
    } catch (error) {
        console.error('获取趋势数据失败:', error)
        res.status(500).json({ error: '获取趋势数据失败' })
    }
})

// 获取请求日志
app.get('/api/v1/app/logs', authMiddleware, (req, res) => {
  try {
    const { view } = req.query
    const logs = readLogs()

    if (view === 'simplified') {
      // 统计每个路由的请求次数
      const routeStats = logs.reduce((acc, log) => {
        const route = `${log.method || 'GET'} ${log.message.split(' ').pop()}`
        if (!acc[route]) {
          acc[route] = { route, count: 0 }
        }
        acc[route].count++
        return acc
      }, {})

      // 转换为数组并按请求次数排序
      const stats = Object.values(routeStats).sort((a, b) => b.count - a.count)
      
      res.json({
        code: 'true',
        data: stats
      })
    } else {
      // 详细视图返回完整日志
      res.json({
        code: 'true',
        data: logs.map(log => ({
          time: log.time,
          success: log.success,
          message: log.message
        })).sort((a, b) => new Date(b.time) - new Date(a.time))
      })
    }
  } catch (error) {
    console.error('获取日志失败:', error)
    res.status(500).json({
      code: 'false',
      msg: '获取日志失败'
    })
  }
})

// 6. 获取统计数据
app.get('/api/v1/app/stats', authMiddleware, (req, res) => {
    try {
        const logs = readLogs();
        const keyData = readKeyData();
        const now = moment();

        // 计算今日请求数
        const todayStart = moment().startOf('day');
        const todayRequests = logs.filter(log => 
            moment(log.time).isAfter(todayStart)
        ).length;

        // 计算昨日请求数
        const yesterdayStart = moment().subtract(1, 'day').startOf('day');
        const yesterdayRequests = logs.filter(log => 
            moment(log.time).isBetween(yesterdayStart, todayStart)
        ).length;

        // 计算密钥相关统计
        const monthStart = moment().startOf('month');
        const activeKeys = keyData.filter(item => {
            const key = Object.keys(item)[0];
            const expiryDate = moment(item[key].code, 'YYYY-MM-DD-HH-mm');
            return moment().isBefore(expiryDate);
        }).length;

        const newKeys = keyData.filter(item => {
            const key = Object.keys(item)[0];
            const created = moment(item[key].created, 'YYYY-MM-DD-HH-mm');
            return created.isAfter(monthStart);
        }).length;

        const expiredKeys = keyData.filter(item => {
            const key = Object.keys(item)[0];
            const expiryDate = moment(item[key].code, 'YYYY-MM-DD-HH-mm');
            return moment().isAfter(expiryDate);
        }).length;

        const expiringKeys = keyData.filter(item => {
            const key = Object.keys(item)[0];
            const expiryDate = moment(item[key].code, 'YYYY-MM-DD-HH-mm');
            const daysUntilExpiry = expiryDate.diff(moment(), 'days');
            return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
        }).length;

        res.json({
            code: "true",
            data: {
                todayRequests,
                requestTrend: yesterdayRequests ? ((todayRequests - yesterdayRequests) / yesterdayRequests * 100).toFixed(1) : 0,
                activeKeys,
                newKeys,
                expiredKeys,
                expiringKeys
            }
        });
    } catch (error) {
        console.error('获取统计数据失败:', error);
        res.status(500).json({
            code: "false",
            msg: '获取统计数据失败'
        });
    }
});

// 2. 获取所有密钥（需要管理员权限）
app.get('/api/v1/app/keys', authMiddleware, (req, res) => {
    try {
        const keyData = readKeyData();
        // 添加额外的密钥信息
        const enrichedKeyData = keyData.map(item => {
            const key = Object.keys(item)[0];
            const data = item[key];
            const expiryDate = moment(data.code, 'YYYY-MM-DD-HH-mm');
            return {
                key,
                msg: data.msg,
                expiry: data.code,
                isExpired: moment().isAfter(expiryDate),
                remainingDays: expiryDate.diff(moment(), 'days'),
                created: data.created || null
            };
        });
        res.json(enrichedKeyData || []);
    } catch (error) {
        console.error('获取密钥列表失败:', error);
        res.status(500).json({ error: '获取密钥列表失败' });
    }
});

// 3. 添加新密钥（需要管理员权限）
app.post('/api/v1/app/key/add', authMiddleware, (req, res) => {
    try {
        const { key, msg, code } = req.body;
        
        if (!key || !msg || !code) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // 验证密钥格式
        if (!/^[A-Za-z0-9_-]{6,32}$/.test(key)) {
            return res.status(400).json({ error: '密钥格式无效（应为6-32位的字母、数字、下划线或横线）' });
        }

        // 验证过期时间格式
        if (!moment(code, 'YYYY-MM-DD-HH-mm', true).isValid()) {
            return res.status(400).json({ error: '过期时间格式无效（应为YYYY-MM-DD-HH-mm）' });
        }

        const keyData = readKeyData();
        
        // 检查密钥是否已存在
        if (keyData.some(item => item[key])) {
            return res.status(400).json({ error: '密钥已存在' });
        }

        const newKey = {
            [key]: {
                code,
                msg,
                created: moment().format('YYYY-MM-DD-HH-mm')
            }
        };

        keyData.push(newKey);
        
        if (saveKeyData(keyData)) {
            // 记录密钥创建操作
            const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
            addLog(key, true, `[ADMIN] 创建新密钥`, ip);
            res.json({ success: true });
        } else {
            res.status(500).json({ error: '保存失败' });
        }
    } catch (error) {
        console.error('添加密钥失败:', error);
        res.status(500).json({ error: '添加密钥失败' });
    }
});

// 4. 删除密钥（需要管理员权限）
app.delete('/api/v1/app/key/:key', authMiddleware, (req, res) => {
    try {
        const keyToDelete = req.params.key;
        const keyData = readKeyData();
        
        // 检查密钥是否存在
        if (!keyData.some(item => item[keyToDelete])) {
            return res.status(404).json({ error: '密钥不存在' });
        }
        
        const updatedData = keyData.filter(item => !item[keyToDelete]);
        
        if (saveKeyData(updatedData)) {
            // 记录密钥删除操作
            const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
            addLog(keyToDelete, true, `[ADMIN] 删除密钥`, ip);
            res.json({ success: true });
        } else {
            res.status(500).json({ error: '删除失败' });
        }
    } catch (error) {
        console.error('删除密钥失败:', error);
        res.status(500).json({ error: '删除密钥失败' });
    }
});

// 续期密钥
app.post('/api/v1/app/key/extend', authMiddleware, (req, res) => {
    try {
        const { key, days } = req.body;
        
        if (!key || !days || isNaN(days) || days <= 0) {
            return res.status(400).json({
                code: "false",
                msg: '参数无效'
            });
        }

        const keyData = readKeyData();
        const keyItem = keyData.find(item => item[key]);
        
        if (!keyItem) {
            return res.status(404).json({
                code: "false",
                msg: '密钥不存在'
            });
        }

        // 获取当前过期时间
        const currentExpiry = moment(keyItem[key].code, 'YYYY-MM-DD-HH-mm');
        // 如果密钥已过期，从当前时间开始计算
        const startDate = moment().isAfter(currentExpiry) ? moment() : currentExpiry;
        // 增加天数
        const newExpiry = startDate.add(days, 'days');
        
        // 更新过期时间
        keyItem[key].code = newExpiry.format('YYYY-MM-DD-HH-mm');
        
        if (saveKeyData(keyData)) {
            // 记录续期操作
            const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
            addLog(key, true, `[ADMIN] 密钥续期 ${days} 天`, ip);
            
            res.json({
                code: "true",
                msg: '续期成功',
                data: {
                    key,
                    newExpiry: keyItem[key].code
                }
            });
        } else {
            res.status(500).json({
                code: "false",
                msg: '保存失败'
            });
        }
    } catch (error) {
        console.error('续期密钥失败:', error);
        res.status(500).json({
            code: "false",
            msg: '续期密钥失败'
        });
    }
});

// 读取用户配置
function readUserConfig() {
    try {
        const configPath = path.join(__dirname, 'db', 'user_config.json');
        if (!fs.existsSync(configPath)) {
            const defaultConfig = {
                avatar: process.env.DEFAULT_AVATAR,
                theme: 'auto',
                username: process.env.ADMIN_USERNAME
            };
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4), 'utf8');
            return defaultConfig;
        }
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
        console.error('读取用户配置失败:', error);
        return {
            avatar: process.env.DEFAULT_AVATAR,
            theme: 'auto',
            username: process.env.ADMIN_USERNAME
        };
    }
}

// 保存用户配置
function saveUserConfig(config) {
    try {
        const configPath = path.join(__dirname, 'db', 'user_config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('保存用户配置失败:', error);
        return false;
    }
}

// 获取用户配置
app.get('/api/v1/user/config', authMiddleware, (req, res) => {
    try {
        const config = readUserConfig();
        res.json(config);
    } catch (error) {
        console.error('获取用户配置失败:', error);
        res.status(500).json({ error: '获取用户配置失败' });
    }
});

// 更新用户配置
app.post('/api/v1/user/config', authMiddleware, (req, res) => {
    try {
        const { avatar, theme, username, currentPassword, newPassword } = req.body;
        const config = readUserConfig();
        
        // 更新头像
        if (avatar) {
            config.avatar = avatar;
        }
        
        // 更新主题
        if (theme) {
            config.theme = theme;
        }
        
        // 更新用户名和密码
        if (currentPassword && newPassword) {
            if (currentPassword !== process.env.ADMIN_PASSWORD) {
                return res.status(400).json({ error: '当前密码错误' });
            }
            
            // 更新环境变量文件中的密码
            const envPath = path.join(__dirname, '.env');
            let envContent = fs.readFileSync(envPath, 'utf8');
            envContent = envContent.replace(
                /ADMIN_PASSWORD=.*/,
                `ADMIN_PASSWORD=${newPassword}`
            );
            fs.writeFileSync(envPath, envContent);
            
            // 重新加载环境变量
            require('dotenv').config();
        }
        
        if (username) {
            config.username = username;
            // 更新环境变量文件中的用户名
            const envPath = path.join(__dirname, '.env');
            let envContent = fs.readFileSync(envPath, 'utf8');
            envContent = envContent.replace(
                /ADMIN_USERNAME=.*/,
                `ADMIN_USERNAME=${username}`
            );
            fs.writeFileSync(envPath, envContent);
            
            // 重新加载环境变量
            require('dotenv').config();
        }
        
        if (saveUserConfig(config)) {
            res.json({ success: true, config });
        } else {
            res.status(500).json({ error: '保存配置失败' });
        }
    } catch (error) {
        console.error('更新用户配置失败:', error);
        res.status(500).json({ error: '更新用户配置失败' });
    }
});

// 清除请求记录
app.post('/api/v1/logs/clear', authMiddleware, (req, res) => {
    try {
        const { clearKey } = req.body;
        
        if (clearKey !== process.env.CLEAR_LOGS_KEY) {
            return res.status(403).json({ error: '清除密钥错误' });
        }
        
        // 清除日志
        saveLogs([]);
        
        // 重置路由统计
        Object.keys(routeStats.requests).forEach(key => {
            routeStats.requests[key] = {
                total: 0,
                success: 0,
                failed: 0,
                blocked: 0,
                lastAccess: null
            };
        });
        
        res.json({ success: true, message: '请求记录已清除' });
    } catch (error) {
        console.error('清除请求记录失败:', error);
        res.status(500).json({ error: '清除请求记录失败' });
    }
});

// 上传头像
app.post('/api/v1/user/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未找到上传的文件' });
    }

    const config = readUserConfig();
    
    // 删除旧头像文件（如果存在且不是默认头像）
    if (config.avatar && !config.avatar.startsWith('http')) {
      const oldAvatarPath = path.join(__dirname, config.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }
    
    // 更新配置中的头像路径
    config.avatar = '/uploads/avatars/' + req.file.filename;
    
    if (saveUserConfig(config)) {
      res.json({
        success: true,
        avatar: config.avatar
      });
    } else {
      res.status(500).json({ error: '保存配置失败' });
    }
  } catch (error) {
    console.error('上传头像失败:', error);
    res.status(500).json({ error: '上传头像失败' });
  }
});

// 提供静态文件访问
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 添加404处理中间件 - 移到所有路由之后
app.use((req, res) => {
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const method = req.method;
    
    // 记录404请求
    routeStats.updateStats(req.path, false, 'failed');
    addLog(null, false, `[${method}] 404 - 路径不存在: ${req.path}`, ip);
    
    res.status(404).json({
        code: "false",
        msg: "请求的路径不存在"
    });
});

// 添加全局错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    
    // 记录服务器错误
    routeStats.updateStats(req.path, false, 'failed');
    addLog(null, false, `[${req.method}] 服务器错误: ${err.message}`, ip);
    
    res.status(500).json({
        code: "false",
        msg: "服务器内部错误"
    });
});

// 根据SSL证书情况选择启动HTTP或HTTPS服务器
const sslCerts = checkSSLCertificates();
if (sslCerts) {
    // 创建HTTPS服务器
    const httpsServer = https.createServer(sslCerts, app);
    httpsServer.listen(port, () => {
        console.log(`HTTPS服务器运行在 https://localhost:${port}`);
    });
} else {
    // 创建HTTP服务器
    const httpServer = http.createServer(app);
    httpServer.listen(port, () => {
        console.log(`HTTP服务器运行在 http://localhost:${port}`);
    });
} 