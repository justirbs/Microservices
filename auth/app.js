const express = require('express');
const session = require('express-session');
const redis = require('redis');
const crypto = require('crypto');

const app = express();

// Trust first proxy
app.set('trust proxy', 1);

// Set up session middleware
app.use(session({
  secret: 's3Cur3',
  name: 'sessionId',
  cookie: {
    httpOnly: true, 
    path: '/', 
    expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  }
}));

app.use(express.json());

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:16380'

console.log('REDIS_URL:', REDIS_URL);
const redisClient = redis.createClient({url:REDIS_URL});

// Redis error handling
redisClient.on('error', (err) => {
    console.error('Redis Error:', err);
  });

redisClient.connect().then(() => {
    console.log('Connected to Redis');

    // Register route
    app.post('/register', (req, res) => {
        const { username, password } = req.body;
    
        // Check if the username already exists in Redis
        redisClient.get(username).then((reply) => {
    
            if (reply) {
                // Username already exists
                res.status(400).json({ message: "Username already exists" });
                
            } else {
                // Hash the password before storing it in Redis
                const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

                // Username doesn't exist, store it in Redis
                redisClient.set(username, hashedPassword).then(() => {
                    res.status(201).json({ message: "Registration successful" });
                }).catch((err) => {
                    console.error(err);
                    res.status(500).json({ message: 'Internal server error' });
                });
            }
        }).catch((err) => {
            console.error(err);
            res.status(500).json({ message: 'Internal server error' });
        });
    });

    // Login route
    app.post('/login', (req, res) => {
        const { username, password } = req.body;

        // Hash the password
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        // Check if the provided username exists in Redis
        redisClient.get(username).then((reply) => {
            if (reply === hashedPassword) {
                // Username and password match
                req.session.user = username;
                res.json({ message: "Login successful" });
            } else {
                // Incorrect username or password
                res.status(401).json({ message: "Incorrect username or password" });
            }
        }).catch((err) => {
            console.error(err);
            res.status(500).json({ message: 'Internal server error' });
        });
    });
});

// Middleware to check if user is logged in
app.use((req, res, next) => {
    if (req.session.user 
        || req.path === '/login.html' 
        || req.path === '/login' 
        || req.path === '/session' 
        || req.path === '/register' 
        || req.path === '/register.html') {
      next();
    } else {
      res.redirect("/login.html");
    }
  });

app.use(express.static('static'));

app.get('/session', (req, res) => {
    // Display content of the session
    res.json(req.session);
  });  

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });