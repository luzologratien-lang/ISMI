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

        // Parse CSV
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true
        });

        // Convert the data
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

        if (data.length === 0) {
            chart.innerHTML = "<p>No valid data found.</p>";
            return;
        }


        // =============================
        // ISMI
        // =============================

        const ismiTrace = {

            x: data.map(d => d.date),

            y: data.map(d => d.ismi),

            type: "scatter",
            mode: "lines",

            name: "ISMI",

            line: {
                width: 2.5
            },

            hovertemplate:
                "<b>%{x|%Y Q%q}</b>" +
                "<br>ISMI: %{y:.3f}" +
                "<extra></extra>"
        };


        // =============================
        // Positive share
        // =============================

        const positiveTrace = {

            x: data.map(d => d.date),

            y: data.map(d => d.positive),

            type: "scatter",
            mode: "lines",

            name: "Positive share",

            line: {
                width: 1.2,
                dash: "dot"
            },

            visible: "legendonly",

            hovertemplate:
                "<b>%{x|%Y Q%q}</b>" +
                "<br>Positive share: %{y:.3f}" +
                "<extra></extra>"
        };


        // =============================
        // Negative share
        // =============================

        const negativeTrace = {

            x: data.map(d => d.date),

            y: data.map(d => d.negative),

            type: "scatter",
            mode: "lines",

            name: "Negative share",

            line: {
                width: 1.2,
                dash: "dot"
            },

            visible: "legendonly",

            hovertemplate:
                "<b>%{x|%Y Q%q}</b>" +
                "<br>Negative share: %{y:.3f}" +
                "<extra></extra>"
        };


        // =============================
        // Layout
        // =============================

        const layout = {

            height: 600,

            plot_bgcolor: "#ffffff",

            paper_bgcolor: "#ffffff",

            xaxis: {

                type: "date",

                title: "Date",

                tickformat: "%Y",

                dtick: "M60",

                showgrid: true,

                gridcolor: "#eeeeee",

                rangeslider: {
                    visible: true,
                    thickness: 0.08
                }
            },

            yaxis: {

                title: "ISMI",

                showgrid: true,

                gridcolor: "#eeeeee",

                zeroline: true,

                zerolinewidth: 1.5
            },

            legend: {

                orientation: "h",

                x: 0,

                y: 1.08
            },

            hovermode: "x unified",

            margin: {

                l: 80,

                r: 30,

                t: 50,

                b: 90
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


        // =============================
        // Chart configuration
        // =============================

        const config = {

            responsive: true,

            displaylogo: false,

            modeBarButtonsToRemove: [
                "lasso2d",
                "select2d"
            ]
        };


        // =============================
        // Draw chart
        // =============================

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

    }

    catch (error) {

        console.error(error);

        chart.innerHTML =
            "<p>There was an error loading the data.</p>";
    }

});
