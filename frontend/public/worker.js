let interval;
let currentFps = 60;

self.onmessage = function(e) {
    if (e.data === 'start') {
        if (interval) clearInterval(interval);
        interval = setInterval(() => self.postMessage('tick'), 1000 / currentFps);
    } else if (e.data && e.data.type === 'setFPS') {
        currentFps = e.data.fps || 60;
        if (interval) {
            clearInterval(interval);
            interval = setInterval(() => self.postMessage('tick'), 1000 / currentFps);
        }
    }
};
