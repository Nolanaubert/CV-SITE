fetch("../assets/php/source.php", {})
    .then(res => res.json())
    .then(data => {
        let html = "";

        data.forEach(item => {
            html += `
            <h3>${item.titre}</h3>
            <p>${item.source}</p>
            <a href="${item.lien}" target="_blank">Lire</a>
            <hr>
        `;
        });

        document.getElementById("content").innerHTML = html;
    });