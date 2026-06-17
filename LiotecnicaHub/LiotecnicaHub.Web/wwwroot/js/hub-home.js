(function () {
    var input = document.getElementById('hub-app-search');
    var grid = document.getElementById('hub-app-grid');
    var empty = document.getElementById('hub-search-empty');
    if (!input || !grid) return;

    input.addEventListener('input', function () {
        var q = input.value.trim().toLowerCase();
        var cards = grid.querySelectorAll('.hub-app-card');
        var visible = 0;

        cards.forEach(function (card) {
            var hay = card.getAttribute('data-search') || '';
            var show = !q || hay.indexOf(q) !== -1;
            card.classList.toggle('is-hidden', !show);
            if (show) visible++;
        });

        if (empty) {
            empty.classList.toggle('is-hidden', visible > 0 || !q);
        }
    });
})();
