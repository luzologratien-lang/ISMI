document.addEventListener("DOMContentLoaded", async function () {

    const chart = document.getElementById("chart");

    try {

        // Load the CSV directly from GitHub
        const response = await fetch(
            "https://raw.githubusercontent.com/luzologratien-lang/ISMI/main/Data/Canadian_ISMI_data.csv"
        );

        if (!response.ok) {
            throw new Error("CSV could not be loaded.");
        }

        const csvText = await response.text();

        console.log("CSV loaded successfully.");
        console.log(csvText.substring(0, 300));

        // Parse CSV
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true
        });

        console.log("Parsed data:", results.data);

        // Create observations
        const data = results.data
            .map(row => {

                const match = String(row.date)
                    .trim()
                    .match(/(\d{4})\s*Q([1-4])/);

                if (!match) return null;

                const year = Number(match[1]);
                const quarter = Number(match[2]);

                const month = (quarter - 1) * 3;

                return {
                    date: new Date(year, month, 1),
                    ismi: Number(row.ISMI),
                    positive: Number(row.positive_share),
                    negative: Number(row.negative_share)
                };

            })
            .filter(row =>
                row !== null &&
                Number.isFinite(row.ismi)
            );

        console.log("Number of observations:", data.length);
        console.log("First observation:", data[0]);
        console.log("Last observation:", data[data.length - 1]);

        if (data.length === 0) {
            chart.innerHTML = "<p>No valid data found.</p>";
            return;
        }

        // -----------------------------
        // ISMI
        // -----------------------------

        const ismiTrace = {
            x: data.map(d => d.date),
            y: data.map(d => d.ismi),

            type: "scatter",
            mode: "lines",

            name: "ISMI",

            line: {
                width: 2
            }
        };

        // -----------------------------
        // Positive share
        // -----------------------------

        const positiveTrace = {
            x: data.map(d => d.date),
            y: data.map(d => d.positive),

            type: "scatter",
            mode: "lines",

            name: "Positive share",

            line: {
                width: 1,
                dash: "dot"
            },

            visible: "legendonly"
        };

        // -----------------------------
        // Negative share
        // -----------------------------

        const negativeTrace = {
            x: data.map(d => d.date),
            y: data.map(d => d.negative),

            type: "scatter",
            mode: "lines",

            name: "Negative share",

            line: {
                width: 1,
                dash: "dot"
            },

            visible: "legendonly"
        };

        // -----------------------------
        // Chart layout
        // -----------------------------

        const layout = {

            title: false,

            height: 600,

            xaxis: {
                type: "date",

                rangeslider: {
                    visible: true
                },

                title: "Date"
            },

            yaxis: {
                title: "ISMI",
                zeroline: true
            },

            hovermode: "x unified",

            legend: {
                orientation: "h"
            },

            margin: {
                l: 80,
                r: 30,
                t: 40,
                b: 100
            },

            shapes: [
                {
                    type: "line",

                    x0: data[0].date,
                    x1: data[data.length - 1].date,

                    y0: 0,
                    y1: 0,

                    line: {
                        width: 1,
                        dash: "dot"
                    }
                }
            ]
        };

        const config = {
            responsive: true,
            displaylogo: false
        };

        // -----------------------------
        // Draw chart
        // -----------------------------

        Plotly.newPlot(
            chart,
            [
                ismiTrace,
                positiveTrace,
                negativeTrace
            ],
            layout,
            config
        );

    } catch (error) {

        console.error("ERROR:", error);

        chart.innerHTML =
            "<p>There was an error loading the data. Check the browser console.</p>";
    }

});
