import React, {
  createRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { MorphIcon } from "morphicons/react";
// Per-icon imports keep the bundle small (importing from "lucide" pulls the
// entire ~1500-icon set). Each file exports the Lucide IconNode as default.
import Bell from "lucide/dist/esm/icons/bell.mjs";
import BellRing from "lucide/dist/esm/icons/bell-ring.mjs";
import Calendar from "lucide/dist/esm/icons/calendar.mjs";
import CalendarDays from "lucide/dist/esm/icons/calendar-days.mjs";
import BookOpen from "lucide/dist/esm/icons/book-open.mjs";
import Users from "lucide/dist/esm/icons/users.mjs";
import Settings from "lucide/dist/esm/icons/settings.mjs";
import Sun from "lucide/dist/esm/icons/sun.mjs";
import Moon from "lucide/dist/esm/icons/moon.mjs";
import Menu from "lucide/dist/esm/icons/menu.mjs";
import X from "lucide/dist/esm/icons/x.mjs";
import Check from "lucide/dist/esm/icons/check.mjs";
import CircleCheck from "lucide/dist/esm/icons/circle-check.mjs";
import ChevronDown from "lucide/dist/esm/icons/chevron-down.mjs";
import ChevronUp from "lucide/dist/esm/icons/chevron-up.mjs";
import ChevronRight from "lucide/dist/esm/icons/chevron-right.mjs";
import ChevronLeft from "lucide/dist/esm/icons/chevron-left.mjs";
import ArrowRight from "lucide/dist/esm/icons/arrow-right.mjs";
import ArrowLeft from "lucide/dist/esm/icons/arrow-left.mjs";
import Plus from "lucide/dist/esm/icons/plus.mjs";
import Search from "lucide/dist/esm/icons/search.mjs";
import RefreshCw from "lucide/dist/esm/icons/refresh-cw.mjs";
import Send from "lucide/dist/esm/icons/send.mjs";
import Clock from "lucide/dist/esm/icons/clock.mjs";
import Lock from "lucide/dist/esm/icons/lock.mjs";
import ShieldCheck from "lucide/dist/esm/icons/shield-check.mjs";
import User from "lucide/dist/esm/icons/user.mjs";
import Trash2 from "lucide/dist/esm/icons/trash-2.mjs";
import Pencil from "lucide/dist/esm/icons/pencil.mjs";
import Eye from "lucide/dist/esm/icons/eye.mjs";
import EyeOff from "lucide/dist/esm/icons/eye-off.mjs";
import Copy from "lucide/dist/esm/icons/copy.mjs";
import ExternalLink from "lucide/dist/esm/icons/external-link.mjs";
import Info from "lucide/dist/esm/icons/info.mjs";
import TriangleAlert from "lucide/dist/esm/icons/triangle-alert.mjs";
import Play from "lucide/dist/esm/icons/play.mjs";
import Pause from "lucide/dist/esm/icons/pause.mjs";
import Volume2 from "lucide/dist/esm/icons/volume-2.mjs";
import VolumeX from "lucide/dist/esm/icons/volume-x.mjs";
import Maximize from "lucide/dist/esm/icons/maximize.mjs";
import Minimize from "lucide/dist/esm/icons/minimize.mjs";
import Star from "lucide/dist/esm/icons/star.mjs";
import LogOut from "lucide/dist/esm/icons/log-out.mjs";
import Megaphone from "lucide/dist/esm/icons/megaphone.mjs";
import FileText from "lucide/dist/esm/icons/file-text.mjs";
import LoaderCircle from "lucide/dist/esm/icons/loader-circle.mjs";
import Circle from "lucide/dist/esm/icons/circle.mjs";
import MessageCircle from "lucide/dist/esm/icons/message-circle.mjs";
import Globe from "lucide/dist/esm/icons/globe.mjs";
import ChevronsUpDown from "lucide/dist/esm/icons/chevrons-up-down.mjs";
import Ellipsis from "lucide/dist/esm/icons/ellipsis.mjs";
import EllipsisVertical from "lucide/dist/esm/icons/ellipsis-vertical.mjs";
import Paperclip from "lucide/dist/esm/icons/paperclip.mjs";
import Wifi from "lucide/dist/esm/icons/wifi.mjs";
import BatteryFull from "lucide/dist/esm/icons/battery-full.mjs";
import Smartphone from "lucide/dist/esm/icons/smartphone.mjs";
import Mail from "lucide/dist/esm/icons/mail.mjs";

type IconNode = readonly (readonly [string, Record<string, any>])[];

/**
 * Central registry: semantic name -> Lucide icon *data* (morphicons morphs between
 * these stroke icons with spring physics). Add entries as new icons are used.
 */
const ICONS: Record<string, IconNode> = {
  bell: Bell,
  bellRing: BellRing,
  calendar: Calendar,
  calendarDays: CalendarDays,
  book: BookOpen,
  users: Users,
  settings: Settings,
  gear: Settings,
  sun: Sun,
  moon: Moon,
  menu: Menu,
  x: X,
  close: X,
  check: Check,
  checkCircle: CircleCheck,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  plus: Plus,
  search: Search,
  refresh: RefreshCw,
  send: Send,
  clock: Clock,
  lock: Lock,
  shield: ShieldCheck,
  user: User,
  trash: Trash2,
  pencil: Pencil,
  eye: Eye,
  eyeOff: EyeOff,
  copy: Copy,
  external: ExternalLink,
  info: Info,
  alert: TriangleAlert,
  play: Play,
  pause: Pause,
  volume: Volume2,
  volumeX: VolumeX,
  maximize: Maximize,
  minimize: Minimize,
  star: Star,
  logout: LogOut,
  megaphone: Megaphone,
  file: FileText,
  loader: LoaderCircle,
  spinner: LoaderCircle,
  circle: Circle,
  message: MessageCircle,
  globe: Globe,
  swap: ChevronsUpDown,
  more: Ellipsis,
  moreV: EllipsisVertical,
  paperclip: Paperclip,
  wifi: Wifi,
  battery: BatteryFull,
  phone: Smartphone,
  mail: Mail,
};

const DEFAULT_ICON: IconNode = Circle;

interface MorphHandle {
  setCurrent: (name: string) => void;
}

interface MorphRootProps {
  initialName: string;
  size?: number;
  color?: string;
  stroke?: number;
  className?: string;
}

const MorphRoot = forwardRef<MorphHandle, MorphRootProps>(function MorphRoot(
  { initialName, size = 20, color = "currentColor", stroke = 2, className },
  ref,
) {
  const [current, setCurrent] = useState(initialName || "circle");
  useImperativeHandle(ref, () => ({ setCurrent }), []);
  const node = ICONS[current] || DEFAULT_ICON;
  return (
    <MorphIcon
      icon={node as any}
      size={size}
      color={color}
      strokeWidth={stroke}
      className={className}
      reducedMotion="user"
    />
  );
});

interface Mounted {
  root: Root;
  ref: React.RefObject<MorphHandle>;
}

const mounted = new Map<Element, Mounted>();

function readDataset(el: HTMLElement) {
  return {
    name: el.dataset.icon || "circle",
    size: el.dataset.size ? Number(el.dataset.size) : 20,
    color: el.dataset.color || "currentColor",
    stroke: el.dataset.stroke ? Number(el.dataset.stroke) : 2,
    className: el.dataset.class || "",
  };
}

function mount(scope: ParentNode | Document = document): void {
  scope.querySelectorAll<HTMLElement>("[data-morph-icon]").forEach((el) => {
    if (mounted.has(el)) return;
    const o = readDataset(el);
    const ref = createRef<MorphHandle>();
    const root = createRoot(el);
    root.render(
      <MorphRoot
        ref={ref}
        initialName={o.name}
        size={o.size}
        color={o.color}
        stroke={o.stroke}
        className={o.className}
      />,
    );
    mounted.set(el, { root, ref });
  });
}

function unmount(scope: ParentNode | Document = document): void {
  scope.querySelectorAll<HTMLElement>("[data-morph-icon]").forEach((el) => {
    const m = mounted.get(el);
    if (m) {
      m.root.unmount();
      mounted.delete(el);
    }
  });
}

/** Morph a mounted icon to a different name (animated). */
function set(el: Element, name: string): void {
  const target =
    mounted.get(el) ||
    (el.querySelector<HTMLElement>("[data-morph-icon]")
      ? mounted.get(el.querySelector<HTMLElement>("[data-morph-icon]")!)
      : undefined);
  target?.ref.current?.setCurrent(name);
}

function mountAll(): void {
  mount(document);
}

declare global {
  interface Window {
    MorphIcons?: {
      mount: typeof mount;
      unmount: typeof unmount;
      set: typeof set;
      mountAll: typeof mountAll;
    };
  }
}

window.MorphIcons = { mount, unmount, set, mountAll };
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }
}

export { mount, unmount, set, mountAll };
