document.addEventListener("DOMContentLoaded", function () {

    const chart = document.getElementById("chart");

    Papa.parse("Data/Canadian_ISMI_data.csv", {

        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,

        complete: function (results) {

            console.log("CSV loaded:", results);

            // Clean column names
            const rows = results.data.map(row => {

                const cleanRow = {};

                Object.keys(row).forEach(key => {
                    cleanRow[key.trim()] = row[key];
                });

                return cleanRow;
            });

            console.log("First row:", rows[0]);
            console.log("Columns:", Object.keys(rows[0] || {}));

            // Keep rows containing a date and ISMI
            const validRows = rows
                .filter(row =>
                    row.date !== undefined &&
                    row.date !== "" &&
                    row.ISMI !== undefined &&
                    row.ISMI !== ""
                )
                .map(row => ({

                    date: quarterToDate(String(row.date).trim()),

                    ismi: Number(row.ISMI),

                    positive: Number(row.positive_share),

                    negative: Number(row.negative_share)

                }))
                .filter(row =>
                    row.date !== null &&
                    Number.isFinite(row.ismi)
                );


            // Check whether data were actually found
            if (validRows.length === 0) {

                chart.innerHTML = `
                    <p style="color:red;">
                        No valid data were found in the CSV file.
                    </p>
                `;

                console.error("No valid rows found.");
                return;
            }


            console.log("Valid rows:", validRows.length);
            console.log("First valid row:", validRows[0]);


            // Extract data
            const dates = validRows.map(row => row.date);
            const ismi = validRows.map(row => row.ismi);
            const positive = validRows.map(row => row.positive);
            const negative = validRows.map(row => row.negative);


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


            // Layout
            const layout = {

                title: "",

                xaxis: {

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
                    b: 70,
                    l: 80

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


            // Configuration
            const config = {

                responsive: true,

                displaylogo: false

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


        error: function (error) {

            console.error("CSV loading error:", error);

            chart.innerHTML = `
                <p style="color:red;">
                    Could not load Data/Canadian_ISMI_data.csv.
                </p>
            `;

        }

    });


    // Convert "1991 Q2" into a JavaScript date
    function quarterToDate(q) {

        if (!q) {
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

});
