// https://www.npmjs.com/package/snowfl-api
const { Snowfl, Sort } = require("snowfl-api"); // common js
const fs = require("fs");
const jht = require("json-html-table");
// use this file as a sub route for express namespaced as /snowfl
const express = require("express");

//body parser
const bodyParser = require("body-parser");
const app = express.Router();
app.use(bodyParser.urlencoded({ extended: true }));
const snowfl = new Snowfl();

// POST /user/signin
app.post("/", async (req, res) => {
  try {
    console.table(req.body);
    const query = req.body?.query;
    if (!query) {
      res.status(200).send("no query");
      return;
    }
    const table = await search_to_table(query);
    res.setHeader("Content-Type", "text/html");
    res.send(table);
  } catch (e) {
    res.status(200).send(e.toString());
  }
});

const searchConfig = {
  sort: Sort.MAX_SEED,
  includeNsfw: false,
};

function magnet_url_to_dl_button(url) {
  // turn a torrent dict into a download button in the table
  return `<button onClick ="autosubmit('${url}')">Easy Download</button>`;
}
function no_magnet(url) {
  return `<a href=${url}>please manually get torrent from here sorry</a>`;
}

async function search_to_table(query) {
  let res = await snowfl.parse(query, searchConfig);
  let jsonArray = res.data;
  // sort to magnet links available first
  jsonArray.sort((a, b) => {
    if (a.magnet == undefined) {
      return 1;
    }
    if (b.magnet == undefined) {
      return -1;
    }
    return 0;
  });
  jsonArray.forEach((element) => {
    element["dlbutton"] = magnet_url_to_dl_button(element["magnet"]);
    if (element.magnet == undefined) {
      element["dlbutton"] = no_magnet(element["url"]);
    }
    element[
      "source_link"
    ] = `<a href="${element["url"]}">${element["name"]}</a>`;
  });
  let keys = [
    // "magnet",
    "dlbutton",
    "size",
    "seeder",
    // "name",
    "source_link",
    "site",
    // "url",
    "age",
    "leecher",
    "type",
    "trusted",
    "nsfw",
  ];
  let hideButton = `<button hx-get="/empty" hx-target="#snowfl-output" hx-swap="innerHTML">(hide table)</button>`;
  let table = hideButton + jht(jsonArray, keys);
  return table;
}

module.exports = app;
