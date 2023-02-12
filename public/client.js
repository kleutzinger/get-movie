// how to gen columns:
// https://github.com/kleutzinger/age-of-actors-dokku-node/blob/7e4fb38742487325765c94924ca2b33f5aeb897a/static/tablemaker.js#L6
function genColumns() {
  return [
    { title: "title", field: "title" },
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
  ];
}
function makeTable(data) {
  let table = new Tabulator("#example-table", {
    data: data, //assign data to table
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
  if (!movies) {
    return [];
  }
  const isHD = (t) =>
    t["quality"].includes("720") || t["quality"].includes("1080");
  let trimmed = movies.map((m) => {
    let torrents = m.torrents;
    return {
      title: m.title,
      torrents: torrents,
      year: m.year,
      download: torrents.map(torrent_to_button_html).join(" "),
      image: m.medium_cover_image,
    };
  });

  return trimmed;
}

async function search() {
  // search for a movie and write to the table
  let search_query = document.getElementById("search-box").value;

  let api_movie_list = await search_yts(fetch, search_query);
  let table = makeTable(transform_api_response(api_movie_list));
}

document.addEventListener("DOMContentLoaded", function (event) {
  search();
});
