import { Component } from "solid-js"

interface ConnectedIconProps {
  connected: boolean
}

export const ConnectedIcon: Component<ConnectedIconProps> = (props) => {
  return <span style={{
    background: props.connected ? "linear-gradient(144deg, rgba(13,143,6,1) 0%, rgba(64,235,105,1) 100%)" : "linear-gradient(144deg, rgba(143,9,6,1) 0%, rgba(235,67,64,1) 100%)",
    "border-radius": "50%",
    width: "1rem",
    height: "1rem",
    display: "inline-block"
  }}></span>
}

