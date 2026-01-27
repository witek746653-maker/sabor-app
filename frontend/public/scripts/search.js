function initWaiterGuideSearch() {
  // Поиск работает по заголовкам разделов (h1-h4) с id.
  // Это безопасно, потому что мы создаём элементы вручную, без вставки HTML.
  var searchInput = document.getElementById("searchInput");
  var searchResults = document.getElementById("searchResults");

  if (!searchInput || !searchResults) {
    return;
  }

  var headings = Array.prototype.slice.call(
    document.querySelectorAll("h1[id], h2[id], h3[id], h4[id]")
  );

  var items = headings
    .map(function (el) {
      return {
        id: el.id,
        text: (el.textContent || "").trim()
      };
    })
    .filter(function (item) {
      return item.id && item.text;
    });

  // Фолбэк: берём пункты из оглавления, если заголовки не найдены.
  if (items.length === 0) {
    var tocLinks = Array.prototype.slice.call(
      document.querySelectorAll(".table_of_contents-link")
    );
    items = tocLinks
      .map(function (link) {
        var href = link.getAttribute("href") || "";
        var id = href.indexOf("#") === 0 ? href.slice(1) : "";
        return {
          id: id,
          text: (link.textContent || "").trim()
        };
      })
      .filter(function (item) {
        return item.id && item.text;
      });
  }

  function clearResults() {
    while (searchResults.firstChild) {
      searchResults.removeChild(searchResults.firstChild);
    }
    searchResults.style.display = "none";
  }

  function renderResults(list) {
    clearResults();

    list.forEach(function (item) {
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.href = "#" + item.id;
      link.textContent = item.text;
      li.appendChild(link);
      searchResults.appendChild(li);
    });

    if (list.length > 0) {
      searchResults.style.display = "block";
    }
  }

  function normalize(text) {
    return (text || "").trim().toLowerCase().replace(/ё/g, "е");
  }

  function handleInput() {
    var query = normalize(searchInput.value);
    if (!query) {
      clearResults();
      return;
    }

    var matches = items.filter(function (item) {
      return normalize(item.text).indexOf(query) !== -1;
    });

    renderResults(matches.slice(0, 30));
  }

  searchInput.addEventListener("input", handleInput);
  searchInput.addEventListener("search", handleInput);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWaiterGuideSearch);
} else {
  initWaiterGuideSearch();
}
