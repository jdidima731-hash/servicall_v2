// Types globaux pour résoudre les erreurs TypeScript

declare module '*.svg' {
  const content: any;
  export default content;
}

declare module '*.png' {
  const content: any;
  export default content;
}

// Types pour les modules manquants
declare module 'tw-animate-css' {
  const content: any;
  export default content;
}
