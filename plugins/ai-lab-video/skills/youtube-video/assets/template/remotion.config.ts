import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// Three.js scenes need a GPU-backed GL context in headless Chrome on macOS.
Config.setChromiumOpenGlRenderer('angle');
