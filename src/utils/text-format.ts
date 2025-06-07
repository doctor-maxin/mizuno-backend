export function capitalize(text) {
    if (text.length > 2 ) { return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() } 
    else return ''
}