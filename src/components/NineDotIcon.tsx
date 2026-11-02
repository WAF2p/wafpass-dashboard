interface NineDotIconProps {
  size?: number
}

/** 3×3 dot grid — the category launcher mark. */
export default function NineDotIcon({ size = 18 }: NineDotIconProps) {
  const coords = [5, 12, 19]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {coords.flatMap(y =>
        coords.map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.65} />)
      )}
    </svg>
  )
}
