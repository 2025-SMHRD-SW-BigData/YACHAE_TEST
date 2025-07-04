const express = require('express');
const passport = require('../config/snsLogin');
const { getConnection } = require('../config/db');
const router = express.Router();

// 요청 로그
router.use((req, res, next) => {
  console.log('login 라우터 호출:', req.method, req.url);
  console.log('body:', req.body);
  next();
});

// 일반 로그인
router.post('/login', async (req, res, next) => {
  const { email, password, login_type } = req.body;
  let connection;
  try {
    connection = await getConnection();
    const sql = `
      SELECT USER_ID, USER_EMAIL, PW, NICK, AGE, PHONE, LOGIN_TYPE
      FROM USERINFO
      WHERE USER_EMAIL = :email AND PW = :password AND LOGIN_TYPE = :login_type
    `;
    const result = await connection.execute(sql, { email, password, login_type });

    console.log('로그인 쿼리 결과:', result.rows[0]);

    if (result.rows.length > 0) {
      const [userId, userEmail, pw, nick, age, phone, loginType] = result.rows[0];
      const user = { USER_ID: userId, USER_EMAIL: userEmail, nick, AGE: age, PHONE: phone, LOGIN_TYPE: loginType };

      req.login(user, err => {
        if (err) return next(err);
        res.json({
          success: true,
          user: {
            userId,
            userEmail,
            nick,
            age,
            phone,
            loginType,
          }
        });
      });
    } else {
      res.json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
    }
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// SNS 로그인 요청 & 콜백
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('http://localhost:5173/mypage')
);

router.get('/kakao', passport.authenticate('kakao'));
router.get('/kakao/callback',
  passport.authenticate('kakao', { failureRedirect: '/' }),
  (req, res) => res.redirect('http://localhost:5173/mypage')
);

router.get('/naver', passport.authenticate('naver'));
router.get('/naver/callback',
  passport.authenticate('naver', { failureRedirect: '/' }),
  (req, res) => res.redirect('http://localhost:5173/mypage')
);

// 비회원 로그인
router.post('/guest-login', async (req, res, next) => {
  let connection;
  try {
    connection = await getConnection();
    const sql = `
      SELECT USER_ID, USER_EMAIL, NICK, AGE, PHONE, LOGIN_TYPE
      FROM USERINFO
      WHERE USER_ID = 999
    `;
    const result = await connection.execute(sql);

    console.log('비회원 로그인 쿼리 결과:', result.rows[0]);

    if (result.rows.length > 0) {
      const [userId, userEmail, nick, age, phone, loginType] = result.rows[0];
      const user = { USER_ID: userId, USER_EMAIL: userEmail, nick, AGE: age, PHONE: phone, LOGIN_TYPE: loginType };

      req.login(user, err => {
        if (err) return next(err);
        res.json({
          success: true,
          user: {
            userId,
            userEmail,
            nick,
            age,
            phone,
            loginType,
          }
        });
      });
    } else {
      res.json({ success: false, message: '비회원 계정을 찾을 수 없습니다.' });
    }
  } catch (err) {
    console.error('비회원 로그인 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 로그아웃
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

// 로그인 상태 확인 및 사용자 정보 반환
router.get('/user', (req, res) => {
  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) {
    const user = req.user || {};

    const userInfo = typeof user === 'string' || typeof user === 'number'
      ? { USER_ID: String(user) }
      : user;

    res.json({
      user: {
        userId: userInfo.USER_ID || userInfo.userId || null,
        userEmail: userInfo.USER_EMAIL || userInfo.userEmail || null,
        nick: userInfo.nick || userInfo.NICK || null,
        age: userInfo.AGE || userInfo.age || null,
        phone: userInfo.PHONE || userInfo.phone || null,
        loginType: userInfo.LOGIN_TYPE || userInfo.loginType || null,
      }
    });
  } else {
    res.status(401).json({ error: '로그인되지 않음' });
  }
});

module.exports = router;
