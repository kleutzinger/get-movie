// example:
// https://github.com/kleutzinger/dotfiles/blob/1486dc19a6522cb806302125eb3518d969a86417/scripts/movie_api.py#L37

const YTS_HOME = "https://yts.mx";
const SEARCH_ENDPOINT = `${YTS_HOME}/api/v2/list_movies.json`;
async function search_yts(fetch, query_term, is_rand_page) {
  const page = is_rand_page ? parseInt(Math.random() * 100) : 1;
  // hit the yts.mx api and return a list of movies
  const params = new URLSearchParams({
    query_term,
    // could do peers to approximate current popularity
    sort_by: "download_count",
    limit: 25,
    page: page,
  });
  const endpoint_with_params = `${SEARCH_ENDPOINT}?${params}`;
  console.log(endpoint_with_params);
  const resp = await fetch(endpoint_with_params);
  return await resp.json();
}

// module.exports = { search_yts };
