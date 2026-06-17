(function () {
    document.querySelectorAll('[data-hub-icon-upload]').forEach(function (root) {
        var fileInput = root.querySelector('[data-icon-file-input]');
        var removeBtn = root.querySelector('[data-icon-remove-btn]');
        var removeFlag = root.querySelector('[data-icon-remove-flag]');
        var previewDefault = root.querySelector('[data-icon-preview-default]');
        var previewCustom = root.querySelector('[data-icon-preview-custom]');
        var previewImg = root.querySelector('[data-icon-preview-img]');
        var currentUrlInput = root.querySelector('[data-icon-current-url]');
        var currentUrl = currentUrlInput ? currentUrlInput.value : '';

        function showDefaultPreview() {
            previewDefault.classList.remove('is-hidden');
            previewCustom.classList.add('is-hidden');
            removeBtn.classList.add('is-hidden');
        }

        function showCustomPreview(src) {
            previewImg.src = src;
            previewDefault.classList.add('is-hidden');
            previewCustom.classList.remove('is-hidden');
            removeBtn.classList.remove('is-hidden');
        }

        function clearSelection() {
            if (fileInput) fileInput.value = '';
            if (removeFlag) removeFlag.value = 'true';
            showDefaultPreview();
        }

        if (currentUrl) {
            showCustomPreview(currentUrl);
            if (removeFlag) removeFlag.value = 'false';
        } else {
            showDefaultPreview();
        }

        if (fileInput) {
            fileInput.addEventListener('change', function () {
                var file = fileInput.files && fileInput.files[0];
                if (!file) return;

                if (removeFlag) removeFlag.value = 'false';

                var reader = new FileReader();
                reader.onload = function (event) {
                    showCustomPreview(event.target.result);
                };
                reader.readAsDataURL(file);
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', function () {
                clearSelection();
            });
        }
    });
})();
