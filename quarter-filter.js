if (typeof filterSelectIds !== 'undefined' && !filterSelectIds.includes('filterQuarter')) {
  filterSelectIds.splice(1, 0, 'filterQuarter');
}

const baseFilteredForQuarter = filtered;
filtered = function () {
  const rows = baseFilteredForQuarter();
  const selected = [...$('filterQuarter').selectedOptions].map(o => o.value);
  if (!selected.length) return rows;
  return rows.filter(r => selected.includes(clean(r.quarter)));
};

const baseRefreshForQuarter = refresh;
refresh = function () {
  opts('filterQuarter', 'quarter');
  baseRefreshForQuarter();
  if ($('filterQuarter')) syncTrigger($('filterQuarter'));
};

window.addEventListener('DOMContentLoaded', () => {
  const quarter = $('filterQuarter');
  if (!quarter) return;
  quarter.addEventListener('change', () => {
    render();
    syncTrigger(quarter);
    updateChips();
  });
});
