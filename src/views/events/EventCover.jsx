import { Icon } from '../../components/Icons';
import { EVENT_TYPE_COLORS, EVENT_TYPE_ICONS } from './eventsView.helpers';

export default function EventCover({ type, image, width = 56, height = 56, radius = 10 }) {
  const color = EVENT_TYPE_COLORS[type] || EVENT_TYPE_COLORS.default;
  const icon = EVENT_TYPE_ICONS[type] || EVENT_TYPE_ICONS.default;
  const iconSize = Math.round(height * 0.42);
  return (
    <div style={{
      width, height, borderRadius: radius, flexShrink: 0, overflow: "hidden", position: "relative",
      background: `linear-gradient(135deg, ${color}28 0%, ${color}0a 100%)`,
      border: `1px solid ${color}35`,
      display: "grid", placeItems: "center",
    }}>
      {image ? (
        <img src={image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          onError={e => { e.target.style.display = "none"; }}/>
      ) : (
        <Icon name={icon} size={iconSize} style={{ color, opacity: 0.85 }}/>
      )}
    </div>
  );
}
