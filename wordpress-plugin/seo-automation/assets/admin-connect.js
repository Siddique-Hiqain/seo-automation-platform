document.addEventListener('DOMContentLoaded', function () {
  const forms = document.querySelectorAll('.seoa-connect-form, .seoa-disconnect-form');

  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault(); // Pause the real submit

      const btn = form.querySelector('.seoa-btn');
      if (!btn || btn.disabled) return;

      const confirmMsg = btn.getAttribute('data-confirm');
      if (confirmMsg && !window.confirm(confirmMsg)) return;

      btn.disabled = true;
      btn.classList.add('just-spinner');

      setTimeout(function () {
        form.submit();
      }, 400);
    });
  });
});
