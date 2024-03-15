const { createHash } = require('crypto');
const express = require('express');
const https = require('https');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = 443;

app.use(express.static('public'));
app.use(express.json());
app.use(cors());

const defaultUserData = {
  twitchUsername: undefined,
  nickname: '',
  chatColor: '#ff0000',
  randomChatColor: true,
  isProtected: false,
  history: []
};

const reservedNames = [
  'zephyr',
  'zephyrsnoww',
  'zephyr snow',
  'goldenpot8o',
  'betafish',
  'catgirlhistorian',
  'limeonade',
  'blanxy',
  'blanxyy',
  'acect',
  'acectttt',
  'tuna',
  'vntuna',
  'householddragon'
];

// ========== Helper Functions ==========
function hash(inputString) {
  return createHash('sha256').update(inputString).digest('base64');
}

// ========== Endpoints ==========
app.get('/api', (req, res) => {
  return res.status(200).send({
    message: 'API is online'
  });
});

// ===== Get User Data (REAL) =====
app.get('/api/users/:twitchUsername', (req, res) => {
  let allUserData = JSON.parse(fs.readFileSync('./data/userData.json'));
  let userData = allUserData.find((_userData) => _userData.twitchUsername == req.params.twitchUsername);

  // If the data doesn't exist, return an error
  if (!userData) {
    return res.status(404).send({
      message: `Twitch username "${req.params.twitchUsername}" isn\'t registered`
    });
  }

  return res.status(200).send(userData);
});

// ===== Get User Data =====
app.put('/api/users/:twitchUsername', (req, res) => {
  let allUserData = JSON.parse(fs.readFileSync('./data/userData.json'));
  let userData = allUserData.find((_userData) => _userData.twitchUsername == req.params.twitchUsername);

  // If the data doesn't exist, return an error
  if (!userData) {
    return res.status(404).send({
      message: `Twitch username "${req.params.twitchUsername}" isn\'t registered`
    });
  }

  // If the data isnt protected, just send it
  if (!userData.isProtected || req.body.noLogin) {
    return res.status(200).send(userData);
  }

  // If the request doesn't have a password, let them know they need one
  if (!req.body?.password) {
    return res.status(401).send({
      message: `Twitch username "${req.params.twitchUsername}" is password protected`
    });
  }

  // Otherwise, hash the password and check it against the stored password hash

  // Get the stored login data
  let storedLogins = JSON.parse(fs.readFileSync('./data/userLogins.json'));
  let storedLogin = storedLogins.find((_login) => _login.twitchUsername == req.params.twitchUsername);

  // If we don't have a password stored, throw an error, just in case
  if (!storedLogin) {
    return res.status(500).send({
      message: `Twitch username "${req.params.twitchUsername}" requires a password, but has no password stored. I have no idea how this could possibly be the case. If you've managed to get this error, you scare me`
    });
  }

  // Get stored hash and hash the password given in the request
  let storedHash = storedLogin.passwordHash;
  let requestHash = hash(req.body.password);

  // If the hashes don't match, tell them they got it wrong
  if (requestHash !== storedHash) {
    return res.status(403).send({
      message: `Incorrect password for Twitch username "${req.params.twitchUsername}"`
    });
  }

  // Otherwise, send the requested data
  return res.status(200).send(userData);
});

// ===== Create User Data =====
app.post('/api/users/:twitchUsername', (req, res) => {
  let allUserData = JSON.parse(fs.readFileSync('./data/userData.json'));
  let userData = allUserData.find((_userData) => _userData.twitchUsername == req.params.twitchUsername);

  // Check if the data already exists
  if (userData) {
    // Return an error if it does
    return res.status(403).send({
      message: `Twitch username "${req.params.twitchUsername}" is already registered`
    });
  }

  // Otherwise, we know the data doesn't exist, so create the data
  let newUserData = defaultUserData;

  newUserData.twitchUsername = req.params.twitchUsername;

  // If they don't want the account protected, just save the data and send it to them
  if (!req.body.protectAccount) {
    allUserData.push(newUserData);
    fs.writeFileSync('./data/userData.json', JSON.stringify(allUserData, undefined, 2));

    return res.status(200).send(newUserData);
  }

  // They DO want the account protected, so hash the password they gave and save it
  newUserData.isProtected = true;

  let loginData = {
    twitchUsername: req.params.twitchUsername,
    passwordHash: hash(req.body.password)
  };

  // Get stored logins
  let storedLogins = JSON.parse(fs.readFileSync('./data/userLogins.json'));

  // Store new data and login
  allUserData.push(newUserData);
  storedLogins.push(loginData);

  // Write data to data files
  fs.writeFileSync('./data/userData.json', JSON.stringify(allUserData, undefined, 2));
  fs.writeFileSync('./data/userLogins.json', JSON.stringify(storedLogins, undefined, 2));

  // Send success response
  return res.status(200).send(newUserData);
});

// ===== Change User Settings =====
app.patch('/api/users/:twitchUsername/settings', (req, res) => {
  let allUserData = JSON.parse(fs.readFileSync('./data/userData.json'));
  let userData = allUserData.find((_userData) => _userData.twitchUsername == req.params.twitchUsername);
  let userIndex = allUserData.indexOf(userData);

  // If the data doesn't exist, return an error
  if (!userData) {
    return res.status(404).send({
      message: `Twitch username "${req.params.twitchUsername}" isn\'t registered`
    });
  }

  // Otherwise, if the user isn't protected, update the data and respond with it
  if (!userData.isProtected) {
    let newUserData = req.body.settings;
    // newUserData.history.push(userData);
    allUserData[userIndex] = newUserData;
    fs.writeFileSync('./data/userData.json', JSON.stringify(allUserData, undefined, 2));

    return res.status(200).send(req.body.settings);
  }

  // Now we know the data exists and is protected
  // If the request didn't include a password, return an error
  if (!req.body?.password) {
    return res.status(401).send({
      message: `Twitch username "${req.params.twitchUsername}" is password protected`
    });
  }

  // We have a given password
  // Get stored password hash
  // Check if they're the same
  // Get the stored login data
  let storedLogins = JSON.parse(fs.readFileSync('./data/userLogins.json'));
  let storedLogin = storedLogins.find((_login) => _login.twitchUsername == req.params.twitchUsername);

  // If we don't have a password stored, throw an error, just in case
  if (!storedLogin) {
    return res.status(500).send({
      message: `Twitch username "${req.params.twitchUsername}" requires a password, but has no password stored. I have no idea how this could possibly be the case. If you've managed to get this error, you scare me`
    });
  }

  // Get stored hash and hash the password given in the request
  let storedHash = storedLogin.passwordHash;
  let requestHash = hash(req.body.password);

  // If the hashes don't match, tell them they got it wrong
  if (requestHash !== storedHash) {
    return res.status(403).send({
      message: `Incorrect password for Twitch username "${req.params.twitchUsername}"`
    });
  }

  // Otherwise, update and send the users settings
  // return res.status(200).send(userData);
  let newUserData = req.body.settings;
  // delete userData.history;
  // newUserData.history.push(userData);
  allUserData[userIndex] = newUserData;
  fs.writeFileSync('./data/userData.json', JSON.stringify(allUserData, undefined, 2));

  return res.status(200).send(req.body.settings);
});

// ========== Run Server ==========
const httpsServer = https.createServer({
  key: fs.readFileSync('/etc/letsencrypt/live/server.zephyrsnow.xyz/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/server.zephyrsnow.xyz/fullchain.pem'),
}, app);

httpsServer.listen(port, () => {
  console.log(`HTTPS Server running on port ${port}`);
});
