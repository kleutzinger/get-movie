const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
require("dotenv").config();
var app = express();
app.use(cors());
// create application/json parser
var bodyParser = require("body-parser");
var rutorrent_url = process.env.RUTORRENT_URL;

async function get_torrent(magnet_url, dir_path) {
  // initiate a torrent download on a remote server
  r = await fetch(`${rutorrent_url}/php/addtorrent.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      url: magnet_url,
      dir_edit: dir_path,
    }),
  });
}

app.set("port", process.env.PORT || 5000);
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", function (request, response) {
  response.sendFile(__dirname + "/index.html");
});

app.post("/post", async function (request, response, next) {
  console.log(request.body);
  get_torrent(request.body.magnet, request.body.mediatype);
  response.sendStatus(200);
});

app.listen(app.get("port"), function () {
  console.log("Node app is running at localhost:" + app.get("port"));
});
`
    resp = requests.request(
        method="POST",
        url=f"{RUTORRENT_URL}/php/addtorrent.php?dir_edit={directory}&label={label}",
        data={"url": magnet},
        verify=True,
    )
`;
