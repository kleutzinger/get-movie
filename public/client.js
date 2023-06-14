// how to gen columns:
// https://github.com/kleutzinger/age-of-actors-dokku-node/blob/7e4fb38742487325765c94924ca2b33f5aeb897a/static/tablemaker.js#L6
function genColumns() {
  return [
    {
      title: "title",
      field: "title",
      formatter: "textarea",
      cssClass: "titletext",
    },
    { title: "year", field: "year" },
    // { title: "torrents", field: "torrents" },
    { title: "initiate download", field: "download", formatter: "html" },
    {
      title: "image",
      field: "image",
      formatter: "image",
      formatterParams: {
        height: "100px",
      },
    },
    { field: "info", title: "info", formatter: "html" },
  ];
}
function makeTable(data) {
  let table = new Tabulator("#example-table", {
    data: data, //assign data to table
    layout: "fitDataFill",
    columns: genColumns(),
    responsiveLayout: "collapse", // collapse columns that no longer fit on the table into a list under the row
    layoutColumnsOnNewData: true,
    // layout: "fitData",
  });

  return table;
}

function autosubmit(t_url) {
  // populate and submit the post request form at the top of the page
  document.getElementById("magnet").value = t_url;
  let submit_button = document.querySelector("#submit");
  submit_button.click();
}

function torrent_to_button_html(torrent) {
  // turn a torrent dict into a download button in the table
  const { quality, type, url, size } = torrent;
  return `<button onClick ="autosubmit('${url}')">${[quality, type, size].join(
    "<br>"
  )}</button>`;
}

function transform_api_response(api_json) {
  // take the api response (list of movies) and turn it into
  // data that the table can understand nicely
  let movies = api_json.data.movies;
  console.log(api_json);
  if (!movies) {
    return [];
  }
  const isHD = (t) =>
    t["quality"].includes("720") || t["quality"].includes("1080");
  const gen_info = (m) => {
    let source = `<a href="${m.url}">source</a>`;
    let imdb = `<a href="https://www.imdb.com/title/${m.imdb_code}/">imdb (${m.rating})</a>`;
    return [source, imdb].join("<br>");
  };
  let trimmed = movies.map((m) => {
    let torrents = m.torrents;
    return {
      title: m.title,
      torrents: torrents,
      year: m.year,
      download: torrents.map(torrent_to_button_html).join(" "),
      image: m.medium_cover_image,
      info: gen_info(m),
    };
  });

  return trimmed;
}

async function get_disk_space_from_server() {
  const endpoint = "/diskspace";
  // fetch endpoint with get request
  let response = await fetch(endpoint);
  let json = await response.json();
  return json;
}

function set_disk_space_in_ui(json) {
  function formatBytes(a, b = 2) {
    if (!+a) return "0 Bytes";
    const c = 0 > b ? 0 : b,
      d = Math.floor(Math.log(a) / Math.log(1024));
    return `${parseFloat((a / Math.pow(1024, d)).toFixed(c))} ${
      ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"][d]
    }`;
  }
  const { total, free } = json;
  //  add a div to the page with the free space
  let free_space_div = document.getElementById("free-space");
  const ratio = `${formatBytes(free)} / ${formatBytes(total)}`;
  const percent_full = ((total - free) / total) * 100;
  const percent_full_text = `${percent_full.toFixed(1)}% full`;
  free_space_div.innerHTML = `free space remaining on disk: ${ratio} (${percent_full_text})`;
}

async function search() {
  // search for a movie and write to the table
  let search_query = document.getElementById("search-box").value;
  // return a random page of the results
  let is_rand = search_query === "";

  let api_movie_list = await search_yts(fetch, search_query, is_rand);
  let table = makeTable(transform_api_response(api_movie_list));
}

document.addEventListener("DOMContentLoaded", async function (event) {
  search();
  let hash = window.location.hash;
  if (hash) {
    // set label to whatever the hash is
    // i.e. "kevin"
    document.getElementById("label").value = hash.replace("#", "");
  }
  set_disk_space_in_ui(await get_disk_space_from_server());
});
