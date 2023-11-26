require("dotenv").config();
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

var express = require("express");
var cors = require("cors");
var emojiFavicon = require("emoji-favicon");
const snowfl = require("./snowfl");
var app = express();
// create application/json parser
var bodyParser = require("body-parser");
var rutorrent_url = process.env.RUTORRENT_URL;

app.set("port", process.env.PORT || 5000);
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use(emojiFavicon("cinema"));
app.use("/snowfl", snowfl);

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

app.get("/empty", function (request, response) {
  response.send("");
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
    extra_options,
  );
  if (is_success) response.status(200).send(`succesfully submitted ${magnet}`);
  else response.sendStatus(400);
});

// get available disk space from rutorrent
app.get("/diskspace", async function (request, response) {
  try {
    const endpoint = `${rutorrent_url}/plugins/diskspace/action.php`;
    const result = await fetch(endpoint);
    const data = await result.json();
    response.json(data);
  } catch (error) {
    console.error(error);
    response.status(500).send("Internal Server Error");
  }
});

const exampleResponse = `
{"items": [
    {
      "action": 2,
      "name": "RCT2_Deluxe_Plus_OpenRCT2.iso",
      "size": 606732288,
      "downloaded": 606732288,
      "uploaded": 0,
      "ratio": 0,
      "creation": 0,
      "added": 1701039458,
      "finished": 1701039502,
      "tracker": "udp://a.bc.d:6969/announce",
      "label": "kevin",
      "action_time": 1701039502,
      "hash": "f1ca51f4afa47f5bed33bf7102952105"
    }, {}
]}

`;
app.get("/dl-status", async function (request, response) {
  try {
    const limit = request.query.limit || 5;
    const endpoint = `${rutorrent_url}/plugins/history/action.php?cmd=get&mark=0`;
    const result = await fetch(endpoint);
    const data = await result.json();
    const sortedData = data.items
      .sort((a, b) => b.added - a.added)
      .sort((a, b) => b.action_time - a.action_time);
    // keep only the most recent items by unique name
    const uniqueNames = new Set();
    const deletedNames = new Set();
    const uniqueData = [];
    for (const item of sortedData) {
      if (item.action === 3) {
        deletedNames.add(item.name);
      }
      if (!uniqueNames.has(item.name)) {
        if (deletedNames.has(item.name)) {
          continue;
        }
        uniqueNames.add(item.name);
        uniqueData.push(item);
      }
    }
    const content = uniqueData
      .slice(0, limit)
      .map((item) => {
        const { name, size, downloaded, added, finished, hash } = item;
        const shortHash = hash.substring(0, 8);
        const sizeGB = (size / 1000000000).toFixed(2);
        const dlStatus = finished == 0 ? "Started" : "Done";

        // Calculate downloaded vs size percent
        const downloadPercent = ((downloaded / size) * 100).toFixed(2);

        return `<tr>
              <td>${name.substring(0, 40)}</td>
              <td>${sizeGB}GB</td>
              <td>${dlStatus}</td>
            </tr>`;
      })
      .join("\n");

    const htmlTable = `<table>
                    <tr>
                      <th>Name</th>
                      <th>Size</th>
                      <th>DL Status</th>
                    </tr>
                    ${content}
                  </table>`;
    response.send(htmlTable);
  } catch (error) {
    console.error(error);
    response.status(500).send("Internal Server Error");
  }
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
    extra_options,
  );
  if (is_success) response.status(200).send(`succesfully submitted ${magnet}`);
  else response.sendStatus(400);
});

app.listen(app.get("port"), function () {
  console.log("Node app is running at http://0.0.0.0:" + app.get("port"));
});
