require("dotenv").config();
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

var express = require("express");
var cors = require("cors");
var emojiFavicon = require("emoji-favicon");
var multer = require("multer");
const snowfl = require("./snowfl");
var app = express();
// create application/json parser
var bodyParser = require("body-parser");
var rutorrent_url = process.env.RUTORRENT_URL;
const TMDB_KEY = process.env.TMDB_KEY;
const upload = multer({ storage: multer.memoryStorage() });

app.set("port", process.env.PORT || 5000);
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use(emojiFavicon("cinema"));
app.use("/snowfl", snowfl);

async function post_torrent_file_base64(torrentBase64, dir_path, extra_options = {}) {
  // send a base64-encoded .torrent file to rutorrent
  let endpoint = `${rutorrent_url}/php/addtorrent.php`;
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
}

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

      return await post_torrent_file_base64(torrentBase64, dir_path, extra_options);
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

const DEFAULT_TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://tracker.dler.org:6969/announce",
  "udp://open.stealth.si:80/announce",
  "udp://open.demonii.com:1337/announce",
  "https://tracker.moeblog.cn:443/announce",
  "udp://open.dstud.io:6969/announce",
  "udp://tracker.srv00.com:6969/announce",
  "https://tracker.zhuqiy.com:443/announce",
  "https://tracker.pmman.tech:443/announce",
];

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
    if (magnet.includes("yts.gg/torrent/download/")) {
      // Extract hash, quality, type, movie title, and movie URL from request
      const hash = request.body.hash;
      const quality = request.body.quality;
      const type = request.body.type;
      const movieTitle = request.body.movieTitle;
      const movieUrl = request.body.movieUrl;

      if (!hash || !quality || !type || !movieTitle) {
        return response.status(400).send("YTS torrents require hash, quality, type, and movieTitle fields");
      }

      // Construct magnet link from hash and trackers
      const displayName = `${movieTitle} ${quality} ${type}`;
      magnet = construct_magnet_link(hash, displayName, DEFAULT_TRACKERS);
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
      response.set("HX-Trigger", "dl-status-refresh");
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

app.post("/post-file", upload.single("torrentfile"), async function (request, response) {
  try {
    if (!request.file) {
      return response.status(400).send("Missing required field: torrentfile");
    }
    if (!request.body.mediatype) {
      return response.status(400).send("Missing required field: mediatype");
    }

    let extra_options = {};
    if (request.body.label && request.body.label !== "no-label") {
      extra_options["label"] = request.body.label;
    }

    const torrentBase64 = request.file.buffer.toString("base64");
    let result = await post_torrent_file_base64(
      torrentBase64,
      request.body.mediatype,
      extra_options
    );

    if (result.success) {
      response.set("HX-Trigger", "dl-status-refresh");
      response.status(200).send(`succesfully submitted ${request.file.originalname}`);
    } else {
      const errorMsg = `Failed to submit torrent file. RuTorrent returned status ${result.status} (${result.statusText}). Response: ${result.responseBody}`;
      console.error("Torrent file submission failed:", errorMsg);
      return response.status(400).send(errorMsg);
    }
  } catch (error) {
    console.error("Error in /post-file endpoint:", error);
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

// rtorrent's own "main" view lists torrents in insertion order, so the most
// recently added torrents are the last entries - unlike the rutorrent
// history plugin (which logs add/finish/delete events separately and, on
// this seedbox, has stopped recording new events entirely).
async function rtorrent_multicall(view, fields) {
  const endpoint = `${rutorrent_url}/plugins/httprpc/action.php`;
  const paramsXml = [view, ...fields]
    .map((p) => `<param><value><string>${p}</string></value></param>`)
    .join("");
  const body = `<?xml version="1.0"?><methodCall><methodName>d.multicall2</methodName><params><param><value><string></string></value></param>${paramsXml}</params></methodCall>`;
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body,
  });
  const xml = await r.text();
  const values = [];
  const regex = /<value><(string|i4|i8|int)>([^<]*)<\/\1><\/value>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    values.push(match[1] === "string" ? match[2] : parseInt(match[2], 10));
  }
  const rows = [];
  for (let i = 0; i < values.length; i += fields.length) {
    rows.push(values.slice(i, i + fields.length));
  }
  return rows;
}

app.get("/dl-status", async function (request, response) {
  try {
    const limit = request.query.limit || 5;
    const rows = await rtorrent_multicall("main", [
      "d.name=",
      "d.size_bytes=",
      "d.bytes_done=",
    ]);
    // most recently added torrents are at the end of the list
    const recent = rows.slice(-limit).reverse();
    let hasActiveDownload = false;
    const content = recent
      .map(([name, size, downloaded]) => {
        const sizeGB = (size / 1000000000).toFixed(2);
        const percent = size > 0 ? Math.min(100, (downloaded / size) * 100) : 0;
        const done = percent >= 100;
        if (!done) hasActiveDownload = true;
        const dlStatus = done ? "Done" : `${percent.toFixed(1)}%`;

        return `<tr>
              <td>${name.substring(0, 40)}</td>
              <td>${sizeGB}GB</td>
              <td>${dlStatus}</td>
            </tr>`;
      })
      .join("\n");

    // poll faster while something is actively downloading
    const pollInterval = hasActiveDownload ? "5s" : "20s";
    const html = `<div id="dl-status" hx-get="/dl-status?limit=${limit}" hx-trigger="load, every ${pollInterval}, click, dl-status-refresh from:body delay:2s" hx-swap="morph:outerHTML" hx-indicator="#spinner-dl" hx-target-500="#dl-status">
                    <table>
                    <tr>
                      <th>Name</th>
                      <th>Size</th>
                      <th>Progress</th>
                    </tr>
                    ${content}
                  </table>
                  </div>`;
    response.send(html);
  } catch (error) {
    console.error(error);
    response.status(500).send("Internal Server Error");
  }
});

app.get("/rutorrent-url", async function (request, response, next) {
  response.json({ url: rutorrent_url });
});

app.get("/tmdb-poster", async function (request, response) {
  const imdb_id = request.query.imdb_id;
  if (!imdb_id || !TMDB_KEY) {
    return response.status(400).send("Missing imdb_id or TMDB_KEY not configured");
  }
  try {
    const url = `https://api.themoviedb.org/3/find/${imdb_id}?external_source=imdb_id&api_key=${TMDB_KEY}`;
    const tmdbResp = await fetch(url);
    const data = await tmdbResp.json();
    const movie = data.movie_results?.[0];
    if (!movie?.poster_path) {
      return response.status(404).send("No poster found");
    }
    return response.redirect(`https://image.tmdb.org/t/p/w185${movie.poster_path}`);
  } catch (error) {
    return response.status(500).send("TMDB lookup error");
  }
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
      response.set("HX-Trigger", "dl-status-refresh");
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
