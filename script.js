document.addEventListener("DOMContentLoaded", function () {

    Papa.parse("Data/Canadian_ISMI_data.csv", {

        download: true,
        header: true,
        dynamicTyping: true,

        complete: function (results) {

            const rows = results.data.filter(
                r => r.date &&
                     r.ISMI !== null &&
                     r.ISMI !== undefined
            );

            // Convert "1991 Q2" into a JavaScript date
            function quarterToDate(q) {

                if (!q || typeof q !== "string") {
                    return null;
                }

                const match = q.match(/(\d{4})\s*Q([1-4])/i);

                if (!match) {
                    return null;
                }

                const year = parseInt(match[1]);
                const quarter = parseInt(match[2]);

                const month = (quarter - 1) * 3;

                return new Date(year, month, 1);
            }

            // Prepare the data
            const validRows = rows
                .map(r => ({
                    date: quarterToDate(r.date),
                    ismi: r.ISMI,
                    positive: r.positive_share,
                    negative: r.negative_share
                }))
                .filter(r => r.date !== null);

            // Extract series
            const dates = validRows.map(r => r.date);
            const ismi = validRows.map(r => r.ismi);
            const positive = validRows.map(r => r.positive);
            const negative = validRows.map(r => r.negative);

            // ISMI
            const traceISMI = {
                x: dates,
                y: ismi,
                name: "ISMI",
                type: "scatter",
                mode: "lines",
                line: {
                    color: "#1f4e79",
                    width: 2
                }
            };

            // Positive share
            const tracePositive = {
                x: dates,
                y: positive,
                name: "Positive share",
                type: "scatter",
                mode: "lines",
                line: {
                    color: "#c0392b",
                    width: 1,
                    dash: "dot"
                },
                visible: "legendonly"
            };

            // Negative share
            const traceNegative = {
                x: dates,
                y: negative,
                name: "Negative share",
                type: "scatter",
                mode: "lines",
                line: {
                    color: "#2874a6",
                    width: 1,
                    dash: "dot"
                },
                visible: "legendonly"
            };

            // Chart layout
            const layout = {

                xaxis: {
                    title: "",
                    type: "date",
                    rangeslider: {
                        visible: true
                    }
                },

                yaxis: {
                    title: "ISMI (positive share − negative share)",
                    zeroline: true
                },

                legend: {
                    orientation: "h",
                    y: 1.08
                },

                margin: {
                    t: 40,
                    r: 30,
                    b: 60,
                    l: 70
                },

                hovermode: "x unified",

                shapes: [
                    {
                        type: "line",
                        x0: dates[0],
                        x1: dates[dates.length - 1],
                        y0: 0,
                        y1: 0,
                        line: {
                            color: "grey",
                            width: 1,
                            dash: "dot"
                        }
                    }
                ]
            };

            // Chart configuration
            const config = {
                responsive: true,
                displaylogo: false,

                modeBarButtonsToRemove: [
                    "lasso2d",
                    "select2d"
                ]
            };

            // Create chart
            Plotly.newPlot(
                "chart",
                [
                    traceISMI,
                    tracePositive,
                    traceNegative
                ],
                layout,
                config
            );
        },

        error: function () {

            document.getElementById("chart").innerText =
                "Could not load Data/Canadian_ISMI_data.csv. Please check the file path.";

        }

    });

});
