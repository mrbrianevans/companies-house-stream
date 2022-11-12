/* import global styles */
import '../styles/indicators.css'
import '../styles/layout.css'
import '../styles/header.scss'
import '../styles/main.css'

/* import scripts */
import './eventManager'
import { startStatusManager } from "./statusManager"

startStatusManager()
