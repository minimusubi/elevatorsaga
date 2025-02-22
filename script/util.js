export function getTemplate(name) {
	return document.getElementById(name).innerHTML.trim();
}

export function getCodeTemplate(name) {
	const contents = document.getElementById(name).textContent;
	let indentCount = 0;

	// Remove indentation added by the fact that the templates in index.html are indented
	// Count the indentation on line 2 (index 1) and remove that many characters on every line
	// Start on line 1 because this line starts to the right of the <script> tag
	return contents
		.split('\n')
		.map((string, index) => {
			if (index === 1) {
				indentCount = string.match(/^\t+/)[0].length;
			}

			return string.substring(indentCount);
		})
		.join('\n')
		.trim();
}
