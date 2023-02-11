// how to gen columns:
// https://github.com/kleutzinger/age-of-actors-dokku-node/blob/7e4fb38742487325765c94924ca2b33f5aeb897a/static/tablemaker.js#L6
function genColumns() {
  return [
    { title: "title", field: "title" },
    { title: "year", field: "year" },
    { title: "torrents", field: "torrents" },
  ];
}
function makeTable(data) {
  let table = new Tabulator("#example-table", {
    data: data, //assign data to table
    resizableColumns: "header",
    columns: genColumns(),
    responsiveLayout: "collapse", // collapse columns that no longer fit on the table into a list under the row
    columnMinWidth: 1,
    virtualDom: true,
    cellVertAlign: "middle",
    cellHozAlign: "center",
    layoutColumnsOnNewData: true,
    // layout: "fitData",
    // layout      : 'fitColumns',
    initialSort: [
      // set the initial sort order of the data
      { column: "order", dir: "asc" },
    ],
  });

  return table;
}

function trim_json(json) {
  let movies = json.data.movies;
  console.log(Object.keys(movies[0]));
  const isHD = (t) =>
    t["quality"].includes("720") || t["quality"].includes("1080");
  let trimmed = movies.map((m) => {
    return {
      title: m.title,
      torrents: m.torrents.filter(isHD),
      year: m.year,
      dl: "<p>dl</p>",
    };
  });

  return trimmed;
}

async function search() {
  var query = document.getElementById("search-box").value;
  // Perform the search with the query here

  let tabledata = await search_yts(fetch, query);
  let trimmed = trim_json(tabledata);

  let table = makeTable(trimmed);
}
