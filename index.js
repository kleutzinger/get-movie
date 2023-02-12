require("dotenv").config();
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

var express = require("express");
var cors = require("cors");
var emojiFavicon = require("emoji-favicon");
var app = express();
// create application/json parser
var bodyParser = require("body-parser");
var rutorrent_url = process.env.RUTORRENT_URL;

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

app.post("/yts", async function (request, response, next) {
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

app.listen(app.get("port"), function () {
  console.log("Node app is running at localhost:" + app.get("port"));
});
