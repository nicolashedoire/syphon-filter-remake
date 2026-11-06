/* Choose a scene before renderer and gameplay initialization. */
(function (global) {
  'use strict';
  const query=global.location&&global.location.search||'';
  // The actor models use texture pages from the original Georgia archive.
  global.SF_CHARACTER_TEXTURED_SCENE=global.SF_TEXTURED_SCENE;
  global.SF_METRO_ACTIVE=/(?:^|[?&])mission=metro(?:&|$)/.test(query);
  if(!global.SF_METRO_ACTIVE)return;
  if(!global.SF_SUBWAY2_TERRAIN||!global.SF_METRO_DATA)throw new Error('Metro assets are missing');
  global.SF_SCENE=global.SF_SUBWAY2_TERRAIN;
  global.SF_TEXTURED_SCENE=global.SF_SUBWAY2_TERRAIN;
  // Props from Georgia Street have unrelated positions and atlas entries.
  global.SF_PROPS=null;
})(window);
