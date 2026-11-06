/*
 * Small gameplay rules ported from the community SF-pc-port project:
 * references/sf-pc-port/src/game/combat.cpp, src/game/hud.cpp and
 * docs/STAGE3_FINDINGS.md. That implementation targets US SCUS-94240 v1.1;
 * the initial vitals and ammunition have not yet been validated for the
 * French executable. Movement rates are scaled from PS1 units to web units.
 * The French executable contains the same 9 mm damage/cadence values in its
 * weapon data table, but their runtime use is not yet proven.
 */
(function (global) {
  'use strict';
  const rules = {
    initialHealth: 150,
    initialArmor: 600,
    magazineCapacity: 15,
    initialReserve: 45,
    walkSpeed: 1.908,
    runSpeed: 6.5786,
    silenced9mmCloseDamage: 50,
    silenced9mmFarDamage: 25,
    silenced9mmCadenceTicks: 4,
    applyPlayerDamage(player, amount) {
      const damage = Math.max(0, Math.floor(amount));
      if (player.armor > 0) player.armor = Math.max(0, player.armor - damage);
      else player.health = Math.max(0, player.health - damage);
    },
    reload(player) {
      const transferred = Math.min(Math.max(0, this.magazineCapacity-player.ammo), player.reserve);
      player.ammo += transferred;
      player.reserve -= transferred;
      return transferred;
    }
  };
  global.SFPS1Rules = Object.freeze(rules);
})(window);
