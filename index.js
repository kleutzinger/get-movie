require("dotenv").config();
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const { auth, requiresAuth } = require('express-openid-connect');

const authConfig = {
  authRequired: true,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: `http://localhost:${process.env.PORT || 5000}`,
  clientID: 'Zhkmi6s8yM6SrabmoxJxRpDNmMgefknw',
  issuerBaseURL: 'https://dev-4gfidufu1t4at7rq.us.auth0.com'
};

var express = require("express");
var cors = require("cors");
var emojiFavicon = require("emoji-favicon");
var app = express();
// create application/json parser
var bodyParser = require("body-parser");
var rutorrent_url = process.env.RUTORRENT_URL;


// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(authConfig));

// req.isAuthenticated is provided from the auth router
app.get('/', (req, res) => {
  res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});

app.get('/a', (req, res) => {
  res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});

app.get('/profile', requiresAuth(), (req, res) => {
  res.send(JSON.stringify(req.oidc.user));
  // res.json(req.oidc);
});

app.set("port", process.env.PORT || 5000);
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use(emojiFavicon("cinema"));

async function get_torrent(magnet_url, dir_path, extra_options = {}) {
  // initiate a torrent download on a remote server
  let endpoint = `${rutorrent_url}/php/addtorrent.php`;
  let body = {
    url: magnet_url,
    dir_edit: dir_path,
    ...extra_options,
  };
  console.log("posting body:", body);
  let r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const text = await r.text();
  console.log(r.status, r.statusText, text);

  return text.includes('"success"') && r.ok;
}

app.get("/", function (request, response) {
  response.sendFile(__dirname + "/index.html");
});

app.post("/post", async function (request, response, next) {
  let extra_options = {};
  if (request.body.label !== "no-label") {
    extra_options["label"] = request.body.label;
  }
  let magnet = request.body.magnet;
  let is_success = await get_torrent(
    magnet,
    request.body.mediatype,
    extra_options
  );
  if (is_success) response.status(200).send(`succesfully submitted ${magnet}`);
  else response.sendStatus(400);
});

// get available disk space from rutorrent
app.get("/diskspace", async function (request, response, next) {
  let endpoint = `${rutorrent_url}/plugins/diskspace/action.php`;
  let r = await fetch(endpoint);
  let json = await r.json();
  response.json(json);
});

app.get("/rutorrent-url", async function (request, response, next) {
  response.json({ url: rutorrent_url });
});

app.post("/yts", async function (request, response, next) {
  let extra_options = {};
  if (request.body.label && request.body.label !== "no-label") {
    extra_options["label"] = request.body.label;
  }
  let magnet = request.body.magnet;
  let is_success = await get_torrent(
    magnet,
    request.body.mediatype,
    extra_options
  );
  if (is_success) response.status(200).send(`succesfully submitted ${magnet}`);
  else response.sendStatus(400);
});

app.listen(app.get("port"), function () {
  console.log("Node app is running at localhost:" + app.get("port"));
});
