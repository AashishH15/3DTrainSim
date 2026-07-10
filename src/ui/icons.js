// Phosphor Icons (MIT license, https://phosphoricons.com) imported as raw SVG.
import githubLogo from "@phosphor-icons/core/assets/bold/github-logo-bold.svg?raw";
import handGrabbing from "@phosphor-icons/core/assets/bold/hand-grabbing-bold.svg?raw";
import cursor from "@phosphor-icons/core/assets/bold/cursor-bold.svg?raw";
import bank from "@phosphor-icons/core/assets/bold/bank-bold.svg?raw";
import eraser from "@phosphor-icons/core/assets/bold/eraser-bold.svg?raw";
import tram from "@phosphor-icons/core/assets/bold/tram-bold.svg?raw";
import trainSimple from "@phosphor-icons/core/assets/bold/train-simple-bold.svg?raw";
import train from "@phosphor-icons/core/assets/bold/train-bold.svg?raw";
import rocket from "@phosphor-icons/core/assets/bold/rocket-bold.svg?raw";
import mapTrifold from "@phosphor-icons/core/assets/bold/map-trifold-bold.svg?raw";
import mapPin from "@phosphor-icons/core/assets/bold/map-pin-bold.svg?raw";
import play from "@phosphor-icons/core/assets/bold/play-bold.svg?raw";
import pause from "@phosphor-icons/core/assets/bold/pause-bold.svg?raw";
import check from "@phosphor-icons/core/assets/bold/check-bold.svg?raw";
import x from "@phosphor-icons/core/assets/bold/x-bold.svg?raw";
import path from "@phosphor-icons/core/assets/bold/path-bold.svg?raw";
import coins from "@phosphor-icons/core/assets/bold/coins-bold.svg?raw";
import arrowCounterClockwise from "@phosphor-icons/core/assets/bold/arrow-counter-clockwise-bold.svg?raw";
import info from "@phosphor-icons/core/assets/bold/info-bold.svg?raw";
import lightning from "@phosphor-icons/core/assets/bold/lightning-bold.svg?raw";
import lockSimple from "@phosphor-icons/core/assets/bold/lock-simple-bold.svg?raw";
import medal from "@phosphor-icons/core/assets/bold/medal-bold.svg?raw";
import star from "@phosphor-icons/core/assets/bold/star-bold.svg?raw";
import usersThree from "@phosphor-icons/core/assets/bold/users-three-bold.svg?raw";
import shareNetwork from "@phosphor-icons/core/assets/bold/share-network-bold.svg?raw";
import bug from "@phosphor-icons/core/assets/bold/bug-bold.svg?raw";
import trophy from "@phosphor-icons/core/assets/bold/trophy-bold.svg?raw";
import warning from "@phosphor-icons/core/assets/bold/warning-bold.svg?raw";
import sparkle from "@phosphor-icons/core/assets/bold/sparkle-bold.svg?raw";
import flame from "@phosphor-icons/core/assets/bold/flame-bold.svg?raw";
import clockCounterClockwise from "@phosphor-icons/core/assets/bold/clock-counter-clockwise-bold.svg?raw";

const SVGS = {
  github: githubLogo,
  select: cursor,
  pan: handGrabbing,
  station: bank,
  bulldoze: eraser,
  tier1: tram,
  tier2: trainSimple,
  tier3: rocket,
  train,
  map: mapTrifold,
  pin: mapPin,
  play,
  pause,
  check,
  close: x,
  route: path,
  coins,
  restart: arrowCounterClockwise,
  info,
  lightning,
  lock: lockSimple,
  passengers: usersThree,
  medal,
  star,
  share: shareNetwork,
  bug,
  trophy,
  warning,
  sparkle,
  flame,
  history: clockCounterClockwise,
};

// Returns inline-SVG markup wrapped in a sizing span. Color follows currentColor.
export function icon(name, cls = "") {
  return `<span class="icon ${cls}" aria-hidden="true">${SVGS[name] ?? ""}</span>`;
}
