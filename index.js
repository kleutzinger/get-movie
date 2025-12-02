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

  // Check if it's an HTTP URL (torrent file download) vs magnet link
  if (magnet_url.startsWith("http")) {
    try {
      console.log("Downloading torrent file from:", magnet_url);
      // Download the torrent file first
      const torrentResponse = await fetch(magnet_url);
      if (!torrentResponse.ok) {
        return {
          success: false,
          status: torrentResponse.status,
          statusText: torrentResponse.statusText,
          responseBody: `Failed to download torrent file from ${magnet_url}`,
        };
      }
      const torrentBuffer = await torrentResponse.arrayBuffer();
      const torrentBase64 = Buffer.from(torrentBuffer).toString('base64');

      // Send the torrent file content to RuTorrent
      let body = {
        torrent_file: torrentBase64,
        dir_edit: dir_path,
        ...extra_options,
      };
      console.log("posting torrent file (base64 length:", torrentBase64.length, ")");
      let r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(body),
      });
      const text = await r.text();
      console.log(r.status, r.statusText, text);

      const success = text.includes('"success"') && r.ok;
      return {
        success,
        status: r.status,
        statusText: r.statusText,
        responseBody: text,
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        statusText: "Internal Error",
        responseBody: `Error downloading/processing torrent file: ${error.message}`,
      };
    }
  } else {
    // It's a magnet link, send it directly
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

    const success = text.includes('"success"') && r.ok;
    return {
      success,
      status: r.status,
      statusText: r.statusText,
      responseBody: text,
    };
  }
}

app.get("/", function (request, response) {
  response.sendFile(__dirname + "/index.html");
});

app.get("/empty", function (request, response) {
  response.send("");
});

async function get_yts_trackers(movie_url) {
  // Fetch the YTS movie page and extract tracker list from any magnet link
  try {
    console.log(`Fetching YTS page for trackers: ${movie_url}`);
    const pageResponse = await fetch(movie_url);
    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch YTS page: ${pageResponse.status} ${pageResponse.statusText}`);
    }
    const html = await pageResponse.text();

    // Extract first magnet link from the page
    const magnetRegex = /magnet:\?[^"'\s]+/;
    const magnetMatch = html.match(magnetRegex);

    if (!magnetMatch) {
      throw new Error("No magnet links found on YTS page");
    }

    const magnetLink = magnetMatch[0];

    // Extract all tracker URLs from the magnet link
    const trackers = [];
    const trackerRegex = /tr=([^&]+)/g;
    let match;
    while ((match = trackerRegex.exec(magnetLink)) !== null) {
      trackers.push(decodeURIComponent(match[1]));
    }

    console.log(`Extracted ${trackers.length} trackers from YTS page`);
    return trackers;
  } catch (error) {
    throw new Error(`Failed to extract trackers: ${error.message}`);
  }
}

function construct_magnet_link(hash, display_name, trackers) {
  // Construct a magnet link from hash, display name, and tracker list
  const dn = encodeURIComponent(display_name);
  const trackerParams = trackers.map(t => `tr=${encodeURIComponent(t)}`).join('&');
  return `magnet:?xt=urn:btih:${hash}&dn=${dn}&${trackerParams}`;
}

app.post("/post", async function (request, response, next) {
  try {
    // Validate required fields
    if (!request.body.magnet) {
      return response.status(400).send("Missing required field: magnet");
    }
    if (!request.body.mediatype) {
      return response.status(400).send("Missing required field: mediatype");
    }

    let extra_options = {};
    if (request.body.label !== "no-label") {
      extra_options["label"] = request.body.label;
    }

    let magnet = request.body.magnet;

    // Check if this is a YTS torrent download URL
    if (magnet.includes("yts.lt/torrent/download/")) {
      // Extract hash, quality, type, movie title, and movie URL from request
      const hash = request.body.hash;
      const quality = request.body.quality;
      const type = request.body.type;
      const movieTitle = request.body.movieTitle;
      const movieUrl = request.body.movieUrl;

      if (!hash || !quality || !type || !movieTitle || !movieUrl) {
        return response.status(400).send("YTS torrents require hash, quality, type, movieTitle, and movieUrl fields");
      }

      // Fetch trackers from the YTS page
      const trackers = await get_yts_trackers(movieUrl);

      // Construct magnet link from hash and trackers
      const displayName = `${movieTitle} ${quality} ${type}`;
      magnet = construct_magnet_link(hash, displayName, trackers);
      console.log("Constructed magnet link:", magnet);
    } else if (!magnet.startsWith("magnet:") && !magnet.startsWith("http")) {
      return response.status(400).send("Invalid magnet link or url - must start with 'magnet:' or 'http'");
    }

    let result = await get_torrent(
      magnet,
      request.body.mediatype,
      extra_options
    );

    if (result.success) {
      response.status(200).send(`succesfully submitted ${magnet}`);
    } else {
      // Provide detailed error information
      const errorMsg = `Failed to submit torrent. RuTorrent returned status ${result.status} (${result.statusText}). Response: ${result.responseBody}`;
      console.error("Torrent submission failed:", errorMsg);
      return response.status(400).send(errorMsg);
    }
  } catch (error) {
    console.error("Error in /post endpoint:", error);
    return response.status(500).send(`Internal server error: ${error.message}`);
  }
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
  try {
    // Validate required fields
    if (!request.body.magnet) {
      return response.status(400).send("Missing required field: magnet");
    }
    if (!request.body.mediatype) {
      return response.status(400).send("Missing required field: mediatype");
    }

    let extra_options = {};
    if (request.body.label && request.body.label !== "no-label") {
      extra_options["label"] = request.body.label;
    }

    let magnet = request.body.magnet;
    let result = await get_torrent(
      magnet,
      request.body.mediatype,
      extra_options
    );

    if (result.success) {
      response.status(200).send(`succesfully submitted ${magnet}`);
    } else {
      // Provide detailed error information
      const errorMsg = `Failed to submit torrent. RuTorrent returned status ${result.status} (${result.statusText}). Response: ${result.responseBody}`;
      console.error("Torrent submission failed:", errorMsg);
      return response.status(400).send(errorMsg);
    }
  } catch (error) {
    console.error("Error in /yts endpoint:", error);
    return response.status(500).send(`Internal server error: ${error.message}`);
  }
});

app.listen(app.get("port"), function () {
  console.log("Node app is running at http://0.0.0.0:" + app.get("port"));
});
