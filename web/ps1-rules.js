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
  // Decode the packed little-endian fields documented for the original item table.
  function decodeWeaponData(bytes) {
    if (!bytes || bytes.length !== 4) throw new TypeError('Expected four weapon data bytes');
    const word = (bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24) >>> 0;
    return {closeDamage:(word >>> 6) & 0x3ff, farDamage:(word >>> 16) & 0x3ff, cadenceTicks:(word >>> 26) & 0x1f};
  }
  // FR SCES-01911 executable: silenced 9 mm packed fields at file offset 0xfd2c8.
  const silenced9mm = decodeWeaponData([0x8a,0x0c,0x19,0x10]);
  const rules = {
    decodeWeaponData,
    initialHealth: 150,
    initialArmor: 600,
    magazineCapacity: 15,
    initialReserve: 45,
    walkSpeed: 1.908,
    runSpeed: 6.5786,
    silenced9mmCloseDamage: silenced9mm.closeDamage,
    silenced9mmFarDamage: silenced9mm.farDamage,
    silenced9mmCadenceTicks: silenced9mm.cadenceTicks,
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
