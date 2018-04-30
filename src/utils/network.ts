/**
 * Retrieves and parses a text file asynchronously.
 * @param url URL of the text file.
 * @param parser Text parser.
 */
export async function downloadAndParse<T>(url: string, parser: (s: string) => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.onreadystatechange = () => {
            if (request.readyState == XMLHttpRequest.DONE) {
                if (request.status == 200){
                    resolve(parser(request.responseText));                    
                } else {
                    reject(new Error('Error status: ' + request.statusText));
                }
            }
        };
        request.send();
    });
}
