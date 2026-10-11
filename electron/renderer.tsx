import {createRoot} from 'react-dom/client';
import {IslandExperience} from '../src/components/island-experience';
import '../src/styles.css';
const root=document.getElementById('root');
if(root) createRoot(root).render(<IslandExperience/>);
if(window.islandDesktop?.overlay) { document.documentElement.style.background='transparent'; document.body.style.background='transparent'; }
