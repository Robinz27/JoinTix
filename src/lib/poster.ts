// Posters are a path under public/ or an https URL (events.poster). next/image only optimises hosts listed
// in next.config.ts, so a picture from elsewhere is shown as it is.

export const isRemote = (src: string) => /^https?:\/\//i.test(src);

/** Whether a poster value is one the site can show: /path/in/public or https://… */
export const isPosterSrc = (src: string) => /^\/[^/\\]/.test(src) || /^https:\/\/[^\s/]+\.[^\s/]+\/\S*$/i.test(src);
