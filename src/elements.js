// Theme authoring by element: each tab groups everything that styles one part of SolidCraft
// (its colours, corner radii and line widths together), instead of listing roles by type.
import { el, heading, button } from './dom.js';
import { at } from './state.js';
import { friendly, fallbackColor, radiusControl, borderCard, iconCards } from './authoring.js';

const LINES = {
  primary: 'The outline of panels, windows and cards.',
  primary_inset: 'A fine second line just inside the outline.',
  secondary: 'Dividers between sections.',
  tertiary: 'The quietest separators.',
  container: 'Frames around grouped content.',
  control: 'The outline of buttons and fields.',
  bevel: 'Raised highlight and shadow edges.'
};

export const SECTIONS = {
  interface: {
    eyebrow: 'PANELS, BARS & CONTROLS', title: 'Interface.',
    intro: 'Every surface and control of the application window. Each part keeps its colours, corner radius and line thickness together.',
    groups: [
      { id: 'appbar', name: 'Application bar', description: 'The strip across the top: logo, tabs, hover states and window controls.', colors: ['app_bar', 'app_bar_text', 'app_bar_tab_active', 'app_bar_separator', 'app_bar_hover', 'app_bar_hover_subtle', 'app_bar_hover_button', 'app_bar_hover_strong', 'logo'] },
      { id: 'panels', name: 'Panels & cards', description: 'The ribbon, browser, history and other docked panels, with their outline and corners.', colors: ['panel', 'panel_header', 'toolbar', 'border', 'overlay', 'chip'], radii: ['radius_lg', 'radius_xl'], borders: ['primary', 'primary_inset', 'tertiary', 'bevel'] },
      { id: 'dialogs', name: 'Dialogs & menus', description: 'Feature dialogs, menus, tooltips and the properties panel.', colors: ['dialog_bg', 'dialog_body', 'dialog_footer', 'dialog_border', 'dialog_rule', 'dialog_label'], borders: ['container', 'secondary'] },
      { id: 'controls', name: 'Buttons & fields', description: 'Text fields, drop-downs, sliders, checkboxes and buttons.', colors: ['control_fill', 'control_border', 'field', 'form_ink', 'form_dim', 'form_primary', 'form_primary_fill'], radii: ['radius_sm', 'radius_md', 'control_radius'], borders: ['control'] },
      { id: 'selection', name: 'Selection & hover', description: 'Highlights for the selected, hovered and box-selected.', colors: ['accent', 'accent_soft', 'selected_bg', 'selected_ink', 'on_accent', 'hover', 'rubber_band', 'box_window', 'box_crossing'] },
      { id: 'navigation', name: 'Compass & navigation bar', description: 'The view compass, cube and the bar of view tools.', colors: ['nav_viewport', 'nav_hover', 'nav_press', 'nav_dim', 'nav_field', 'nav_tip', 'nav_tip_ink', 'nav_tip_key_border', 'cube_face', 'cube_border', 'cube_text', 'cube_hover'] },
      { id: 'history', name: 'History timeline', description: 'The strip of features along the bottom.', colors: ['timeline', 'timeline_item', 'timeline_item_error', 'timeline_marker'] },
      { id: 'status', name: 'Status & feedback', description: 'Errors, warnings, success and the assistant’s state.', colors: ['error', 'warning', 'form_error', 'form_error_fill', 'form_success', 'form_success_fill', 'agent_ok', 'agent_busy'] },
      { id: 'file', name: 'File page', description: 'The start page: recent files, recovery and the side rail.', colors: ['file_background', 'file_surface', 'file_border', 'file_dim', 'file_image_tint', 'file_rail', 'file_rail_ink', 'file_rail_hover', 'file_primary', 'file_primary_ink', 'file_primary_border', 'file_recovery', 'file_recovery_ink', 'file_recovery_border', 'file_recovery_well'] }
    ]
  },
  viewport: {
    eyebrow: 'THE MODELLING SPACE', title: 'Viewport & sketch.',
    intro: 'The 3D scene and sketch mode: background, grid, geometry, selection and dimensions.',
    groups: [
      { id: 'background', name: 'Background & grid', description: 'The backdrop gradient and the grid lines on it.', colors: ['viewport_top', 'viewport_bottom', 'grid', 'grid_major'] },
      { id: 'axes', name: 'Origin & axes', description: 'The origin, its planes and axes, and construction geometry.', colors: ['axis_x', 'axis_y', 'axis_z', 'origin_point', 'origin_plane', 'origin_plane_edge', 'origin_plane_hover', 'construction_plane', 'construction_geom'] },
      { id: 'bodies', name: 'Bodies & surfaces', description: 'Solid bodies, their edges, and analysis colours.', colors: ['body', 'body_edge', 'body_selected', 'continuity', 'interference', 'bend_up', 'bend_down', 'section_cap'] },
      { id: 'picking', name: 'Selection & hover in 3D', description: 'Faces, edges, vertices and profiles when picked or hovered.', colors: ['sel_face', 'sel_edge', 'sel_edge_rim', 'sel_vertex', 'hover_edge', 'hover_edge_halo', 'sel_profile', 'sel_profile_edge', 'hover_profile', 'hover_profile_edge', 'profile_fill'] },
      { id: 'manipulators', name: 'Manipulators & previews', description: 'Drag handles, joints, and the previews of what a feature will do.', colors: ['manipulator', 'joint_manipulator', 'joint_axis', 'preview_add', 'preview_new', 'preview_sketch', 'preview_cut'] },
      { id: 'sketch', name: 'Sketch geometry', description: 'Lines and curves by state: normal, fixed, locked, construction, projected or in conflict.', colors: ['sketch', 'sketch_fixed', 'sketch_locked', 'sketch_conflict', 'sketch_lost', 'sketch_projected', 'sketch_construction', 'sketch_centerline', 'sketch_halo'] },
      { id: 'points', name: 'Sketch points & dimensions', description: 'Points and the driving and driven dimensions.', colors: ['sketch_point', 'sketch_point_free', 'dimension', 'dimension_driven'], radii: ['sketch_mode_radius'] }
    ]
  },
  text: {
    eyebrow: 'SMALL, BUT IMPORTANT', title: 'Text & icons.',
    intro: 'Text colours, and the original SolidCraft icon artwork recoloured by meaning. Masks and transparent gaps stay untouched.',
    groups: [
      { id: 'text', name: 'Text', description: 'Primary and secondary text, and the default icon ink.', colors: ['text', 'text_dim', 'icon'] },
      { id: 'iconroles', name: 'Icon drawing roles', description: 'The colours the artwork is drawn with: lines, ink, guides and accent shades.', icons: 'roles' },
      { id: 'iconramps', name: 'Icon colour ramps', description: 'One ramp per meaning: solids, sketch, constraints, construction, surfaces and meshes.', icons: 'ramps' },
      { id: 'glyphs', name: 'Viewport glyphs', description: 'Labels, markers and glyph badges drawn inside the viewport.', colors: ['glyph_bg', 'glyph_edge', 'glyph_text', 'icons.highlight', 'icons.agent', 'icons.marker_halo'] }
    ]
  }
};

// Workspace accent families: which colour roles belong to which workspace tab.
const FAMILIES = {
  SURFACE: ['surface_fill', 'surface_ink', 'surface_soft', 'surface_accent'],
  MESH: ['mesh_fill', 'mesh_ink', 'mesh_soft', 'mesh_accent'],
  FORM: ['form_fill', 'form_soft', 'form_accent', 'form_tab_ink'],
  'SHEET METAL': ['sheet_fill', 'sheet_ink', 'sheet_soft'],
  RENDER: ['render_fill', 'render_ink', 'render_soft', 'render_accent'],
  SKETCH: ['sketch_accent', 'sketch_ink', 'sketch_soft']
};

/** Where a role is edited: { section, group } for a colour key, border role, radius or icon key. */
export function locate(editor, key) {
  const wanted = key.startsWith('borders.') ? ['borders', key.split('.')[1]] : key.startsWith('radii.') ? ['radii', key.slice(6)] : key.startsWith('icon_palette.') ? ['icon', key.slice(13)] : ['colors', key];
  for (const [section, spec] of Object.entries(SECTIONS)) {
    for (const group of spec.groups) {
      if (wanted[0] === 'colors' && group.colors?.includes(wanted[1])) return { section, group: group.id, token: wanted[1] };
      if (wanted[0] === 'borders' && group.borders?.includes(wanted[1])) return { section, group: group.id, property: `borders.${wanted[1]}` };
      if (wanted[0] === 'radii' && group.radii?.includes(wanted[1])) return { section, group: group.id, property: `radii.${wanted[1]}` };
      if (wanted[0] === 'icon' && group.icons) {
        const ramp = (editor.contract.iconAccentKeys || []).includes(wanted[1]);
        if ((group.icons === 'ramps') === ramp) return { section, group: group.id, property: key };
      }
    }
  }
  if (wanted[1] === 'tab_on_fill_dark') return { section: 'workspaces', group: 'ws-all', token: 'tab_on_fill_dark' };
  if (wanted[0] === 'colors') for (const [name, keys] of Object.entries(FAMILIES)) if (keys.includes(wanted[1])) return { section: 'workspaces', group: `ws-${name}`, token: wanted[1] };
  return null;
}

const part = (title, ...children) => el('div', { class: 'element-part' }, el('h4', { class: 'part-heading' }, title), ...children);

function authoredCount(editor, group, known) {
  const doc = editor.store.get().document;
  let n = (group.colors || []).filter(key => known.has(key) && at(doc, ['colors', key]) !== undefined).length;
  n += (group.radii || []).filter(key => doc.radii?.[key] !== undefined).length + (group.borders || []).filter(role => doc.borders?.[role] !== undefined).length;
  if (group.icons) n += Object.keys(doc.icon_palette || {}).filter(key => (group.icons === 'ramps') === Array.isArray(doc.icon_palette[key])).length;
  return n;
}

/** Build one group card; its body is created the first time it opens. */
function groupCard(editor, group, known, open) {
  const count = authoredCount(editor, group, known);
  const details = el('details', { class: 'element-group', open, 'data-group': group.id }, el('summary', {}, el('span', {}, group.name), el('span', { class: 'category-count' }, count ? `${count} changed` : '')));
  const body = el('div', { class: 'element-body' });
  let built = false;
  details._build = () => {
    if (built) return; built = true;
    body.append(el('p', { class: 'field-help group-description' }, group.description));
    const colors = (group.colors || []).filter(key => known.has(key));
    if (colors.length) body.append(part('Colours', el('div', { class: 'element-colors' }, ...colors.map(key => editor.token(['colors', key], key, fallbackColor(editor, key))))));
    if (group.radii?.length) body.append(part('Corners', el('div', { class: 'group-card radii-card' }, ...group.radii.map(key => radiusControl(editor, key)))));
    if (group.borders?.length) body.append(part('Lines', el('p', { class: 'field-help' }, 'Thickness and colour for each line, kept together.'), el('div', { class: 'card-grid' }, ...group.borders.map(role => borderCard(editor, role, LINES[role])))));
    if (group.icons) body.append(iconCards(editor, group.icons));
  };
  details.append(body);
  details.addEventListener('toggle', () => { if (details.open) details._build(); });
  if (open) details._build();
  return details;
}

/** An element tab: filter chips over collapsible element groups. */
export function elementEditor(editor, id) {
  const spec = SECTIONS[id], known = new Set(editor.keys('color'));
  editor.root.append(heading(spec.eyebrow, spec.title, spec.intro));
  const facets = el('div', { class: 'palette-facets', 'aria-label': `${spec.title} parts` }), list = el('div');
  const cards = spec.groups.map((group, i) => groupCard(editor, group, known, i === 0));
  const show = facet => {
    facets.replaceChildren(...[['all', 'All'], ...spec.groups.map(group => [group.id, group.name])].map(([key, name]) => {
      const chip = button(name, () => show(key), `facet${facet === key ? ' selected' : ''}`); chip.setAttribute('aria-pressed', facet === key); return chip;
    }));
    cards.forEach((card, i) => {
      const match = facet === 'all' || facet === spec.groups[i].id;
      card.hidden = !match;
      if (facet !== 'all' && match) { card.open = true; card._build(); }
    });
  };
  list.append(...cards); editor.root.append(facets, list); show('all');
  editor.root._reveal = groupId => { show('all'); const card = list.querySelector(`[data-group="${CSS.escape(groupId)}"]`); if (card) { card.open = true; card._build(); } };
}

/** Workspaces: the accent colours and the three surfaces each workspace tab can restyle. */
export function workspaceEditor(editor) {
  editor.root.append(heading('A CHANGE OF SCENERY', 'Workspaces.', 'Each workspace has its own accent. Optionally give it its own panel and viewport surfaces too, shown when Tab colours is on.'));
  const doc = editor.store.get().document, known = new Set(editor.keys('color'));
  const authored = doc.tabs || {}, tabs = editor.contract.tabsAllowed || [], keys = editor.contract.tabSurfaceKeys || ['panel', 'viewport_top', 'viewport_bottom'];
  if (known.has('tab_on_fill_dark')) {
    const shared = el('details', { class: 'element-group', open: true, 'data-group': 'ws-all' }, el('summary', {}, el('span', {}, 'All workspaces')));
    shared.append(el('div', { class: 'element-body' }, el('p', { class: 'field-help group-description' }, 'The fill of the active tab, shared by every workspace.'), part('Colours', el('div', { class: 'element-colors' }, editor.token(['colors', 'tab_on_fill_dark'], 'tab_on_fill_dark', fallbackColor(editor, 'tab_on_fill_dark'))))));
    editor.root.append(shared);
  }
  const list = el('div');
  for (const tab of [...new Set([...Object.keys(authored), ...tabs])]) {
    const values = authored[tab], family = (FAMILIES[tab] || []).filter(key => known.has(key));
    const details = el('details', { class: 'element-group', 'data-group': `ws-${tab}` }, el('summary', {}, el('span', {}, friendly(tab.toLowerCase())), el('span', { class: 'category-count' }, values ? `${Object.keys(values).length} surfaces` : '')));
    const body = el('div', { class: 'element-body' });
    body.append(el('div', { class: 'button-row' }, button('View this workspace', () => editor.store.setContext(tab, editor.store.get().vision), 'button small')));
    if (family.length) body.append(part('Accent', el('div', { class: 'element-colors' }, ...family.map(key => editor.token(['colors', key], key, fallbackColor(editor, key))))));
    body.append(part('Surfaces', el('div', { class: 'element-colors' }, ...keys.map(key => editor.token(['tabs', tab, key], key, fallbackColor(editor, key))))));
    if (values) body.append(button('Use inherited surfaces', () => { editor.update(['tabs', tab], undefined); editor.show(); }, 'text-button'));
    details.append(body); list.append(details);
  }
  editor.root.append(list);
}
