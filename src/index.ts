import { createHash } from "crypto";
import express, { static as _static, json, Request, Response } from "express";
import { createServer } from "https";
import cors from "cors";
import { readFileSync, writeFileSync } from "fs";

const app = express();
const port = 3000;

app.use(_static("public"));
app.use(json());
app.use(cors());

type UserData = {
  twitchUsername?: string;
  nickname: string;
  chatColor: string;
  randomChatColor: boolean;
  isProtected: boolean;
  history: string[];
};

const defaultUserData: UserData = {
  twitchUsername: undefined,
  nickname: "",
  chatColor: "#ff0000",
  randomChatColor: true,
  isProtected: false,
  history: [],
};

type UserLogin = {
  twitchUsername: string;
  passwordHash: string;
};

// 🙀
// const reservedNames = [
//   "zephyr",
//   "zephyrsnoww",
//   "zephyr snow",
//   "goldenpot8o",
//   "betafish",
//   "catgirlhistorian",
//   "limeonade",
//   "blanxy",
//   "blanxyy",
//   "acect",
//   "acectttt",
//   "tuna",
//   "vntuna",
//   "householddragon",
// ];

type DataFiles = {
  userData: UserData[];
  userLogins: UserLogin[];
};

function loadData<T extends keyof DataFiles>(fileName: T): DataFiles[T] {
  return JSON.parse(
    readFileSync(`../data/${fileName}.json`, { encoding: "utf-8" })
  ) as DataFiles[T];
}

function saveData<T extends keyof DataFiles>(fileName: T, data: DataFiles[T]) {
  writeFileSync(`../data/${fileName}.json`, JSON.stringify(data, undefined, 2));
}

// ========== Helper Functions ==========
function hash(input: string) {
  return createHash("sha256").update(input).digest("base64");
}

// ========== Endpoints ==========
app.get("/api", (req, res) => {
  return res.status(200).send({
    message: "API is online",
  });
});

// ===== Get User Data (REAL) =====
app.get("/api/users/:twitchUsername", (req, res) => {
  const allUserData = loadData("userData");
  const userData = allUserData.find(
    (_userData) => _userData.twitchUsername == req.params.twitchUsername
  );

  // If the data doesn't exist, return an error
  if (!userData) {
    return res.status(404).send({
      message: `Twitch username "${req.params.twitchUsername}" isn't registered`,
    });
  }

  return res.status(200).send(userData);
});

// ===== Get User Data =====
type ReqError = { message: string };

type GetUserRequest = Request<
  { twitchUsername: string },
  unknown,
  { noLogin: boolean; password: string }
>;

type GetUserResponse = Response<UserData | ReqError>;

app.put(
  "/api/users/:twitchUsername",
  (req: GetUserRequest, res: GetUserResponse) => {
    const allUserData = loadData("userData");
    const userData = allUserData.find(
      (_userData) => _userData.twitchUsername == req.params.twitchUsername
    );

    // If the data doesn't exist, return an error
    if (!userData) {
      return res.status(404).send({
        message: `Twitch username "${req.params.twitchUsername}" isn't registered`,
      });
    }

    // If the data isnt protected, just send it
    if (!userData.isProtected || req.body.noLogin) {
      return res.status(200).send(userData);
    }

    // If the request doesn't have a password, let them know they need one
    if (!req.body?.password) {
      return res.status(401).send({
        message: `Twitch username "${req.params.twitchUsername}" is password protected`,
      });
    }

    // Otherwise, hash the password and check it against the stored password hash

    // Get the stored login data
    const storedLogins = loadData("userLogins");
    const storedLogin = storedLogins.find(
      (_login) => _login.twitchUsername == req.params.twitchUsername
    );

    // If we don't have a password stored, throw an error, just in case
    if (!storedLogin) {
      return res.status(500).send({
        message: `Twitch username "${req.params.twitchUsername}" requires a password, but has no password stored. I have no idea how this could possibly be the case. If you've managed to get this error, you scare me`,
      });
    }

    // Get stored hash and hash the password given in the request
    const storedHash = storedLogin.passwordHash;
    const requestHash = hash(req.body.password);

    // If the hashes don't match, tell them they got it wrong
    if (requestHash !== storedHash) {
      return res.status(403).send({
        message: `Incorrect password for Twitch username "${req.params.twitchUsername}"`,
      });
    }

    // Otherwise, send the requested data
    return res.status(200).send(userData);
  }
);

// ===== Create User Data =====

type CreateUserRequest = Request<
  { twitchUsername: string },
  unknown,
  { noLogin: boolean; password: string; protectAccount: boolean }
>;

type CreateUserResponse = Response<UserData | ReqError>;

app.post(
  "/api/users/:twitchUsername",
  (req: CreateUserRequest, res: CreateUserResponse) => {
    const allUserData = loadData("userData");
    const userData = allUserData.find(
      (_userData) => _userData.twitchUsername == req.params.twitchUsername
    );

    // Check if the data already exists
    if (userData) {
      // Return an error if it does
      return res.status(403).send({
        message: `Twitch username "${req.params.twitchUsername}" is already registered`,
      });
    }

    // Otherwise, we know the data doesn't exist, so create the data
    const newUserData = defaultUserData;

    newUserData.twitchUsername = req.params.twitchUsername;

    // If they don't want the account protected, just save the data and send it to them
    if (!req.body.protectAccount) {
      allUserData.push(newUserData);
      saveData("userData", allUserData);

      return res.status(200).send(newUserData);
    }

    // They DO want the account protected, so hash the password they gave and save it
    newUserData.isProtected = true;

    const loginData = {
      twitchUsername: req.params.twitchUsername,
      passwordHash: hash(req.body.password),
    };

    // Get stored logins
    const storedLogins = loadData("userLogins");

    // Store new data and login
    allUserData.push(newUserData);
    storedLogins.push(loginData);

    // Write data to data files
    saveData("userData", allUserData);
    saveData("userLogins", storedLogins);

    // Send success response
    return res.status(200).send(newUserData);
  }
);

// ===== Change User Settings =====

type UpdateSettingsRequest = Request<
  { twitchUsername: string },
  unknown,
  { settings: UserData; password: string }
>;
type UpdateSettingsResponse = Response<UserData | ReqError>;

app.patch(
  "/api/users/:twitchUsername/settings",
  (req: UpdateSettingsRequest, res: UpdateSettingsResponse) => {
    const allUserData = loadData("userData");
    const userIndex = allUserData.findIndex(
      (_userData) => _userData.twitchUsername == req.params.twitchUsername
    );
    const userData = allUserData[userIndex];

    // If the data doesn't exist, return an error
    if (!userData) {
      return res.status(404).send({
        message: `Twitch username "${req.params.twitchUsername}" isn't registered`,
      });
    }

    // Otherwise, if the user isn't protected, update the data and respond with it
    if (!userData.isProtected) {
      const newUserData = req.body.settings;
      // newUserData.history.push(userData);
      allUserData[userIndex] = newUserData;
      saveData("userData", allUserData);

      return res.status(200).send(req.body.settings);
    }

    // Now we know the data exists and is protected
    // If the request didn't include a password, return an error
    if (!req.body?.password) {
      return res.status(401).send({
        message: `Twitch username "${req.params.twitchUsername}" is password protected`,
      });
    }

    // We have a given password
    // Get stored password hash
    // Check if they're the same
    // Get the stored login data
    const storedLogins = loadData("userLogins");
    const storedLogin = storedLogins.find(
      (_login) => _login.twitchUsername == req.params.twitchUsername
    );

    // If we don't have a password stored, throw an error, just in case
    if (!storedLogin) {
      return res.status(500).send({
        message: `Twitch username "${req.params.twitchUsername}" requires a password, but has no password stored. I have no idea how this could possibly be the case. If you've managed to get this error, you scare me`,
      });
    }

    // Get stored hash and hash the password given in the request
    const storedHash = storedLogin.passwordHash;
    const requestHash = hash(req.body.password);

    // If the hashes don't match, tell them they got it wrong
    if (requestHash !== storedHash) {
      return res.status(403).send({
        message: `Incorrect password for Twitch username "${req.params.twitchUsername}"`,
      });
    }

    // Otherwise, update and send the users settings
    // return res.status(200).send(userData);
    const newUserData = req.body.settings;
    // delete userData.history;
    // newUserData.history.push(userData);
    allUserData[userIndex] = newUserData;
    saveData("userData", allUserData);

    return res.status(200).send(req.body.settings);
  }
);

// ========== Run Server ==========
// that should probably be an external and gitignored config of sorts
// also maybe an option to run http locally
const httpsServer = createServer(
  {
    key: readFileSync(
      "/etc/letsencrypt/live/server.zephyrsnow.xyz/privkey.pem"
    ),
    cert: readFileSync(
      "/etc/letsencrypt/live/server.zephyrsnow.xyz/fullchain.pem"
    ),
  },
  app
);

httpsServer.listen(port, () => {
  console.log(`HTTPS Server running on port ${port}`);
});