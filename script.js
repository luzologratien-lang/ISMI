document.addEventListener("DOMContentLoaded", function () {

    const chart = document.getElementById("chart");

    Papa.parse("Data/Canadian_ISMI_data.csv", {

        download: true,
        header: false,
        skipEmptyLines: true,

        complete: function (results) {

            console.log("CSV successfully loaded.");
            console.log(results.data);

            const rows = results.data;

            // Remove the header row
            rows.shift();

            // Convert the CSV into usable observations
            const validRows = rows
                .map(row => {

                    return {
                        date: quarterToDate(row[1]),
                        positive: parseFloat(row[2]),
                        negative: parseFloat(row[3]),
                        ismi: parseFloat(row[4])
                    };

                })
                .filter(row =>
                    row.date !== null &&
                    Number.isFinite(row.ismi)
                );


            console.log("Number of observations:", validRows.length);
            console.log("First observation:", validRows[0]);


            // Stop if no data were found
            if (validRows.length === 0) {

                chart.innerHTML =
                    "<p>Unable to find valid ISMI observations.</p>";

                return;
            }


            // Extract the series
            const dates = validRows.map(row => row.date);

            const ismi = validRows.map(row => row.ismi);

            const positive = validRows.map(row => row.positive);

            const negative = validRows.map(row => row.negative);


            // ------------------------------------------------
            // ISMI
            // ------------------------------------------------

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


            // ------------------------------------------------
            // Positive share
            // ------------------------------------------------

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


            // ------------------------------------------------
            // Negative share
            // ------------------------------------------------

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


            // ------------------------------------------------
            // Chart layout
            // ------------------------------------------------

            const layout = {

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


            // ------------------------------------------------
            // Chart configuration
            // ------------------------------------------------

            const config = {

                responsive: true,

                displaylogo: false

            };


            // ------------------------------------------------
            // Create the chart
            // ------------------------------------------------

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

            console.error(error);

            chart.innerHTML =
                "<p>Could not load the ISMI data.</p>";

        }

    });


    // ------------------------------------------------
    // Convert "1991 Q2" → JavaScript date
    // ------------------------------------------------

    function quarterToDate(q) {

        if (!q) {
            return null;
        }

        const match = String(q)
            .trim()
            .match(/(\d{4})\s*Q([1-4])/i);

        if (!match) {
            return null;
        }

        const year = parseInt(match[1]);

        const quarter = parseInt(match[2]);

        const month = (quarter - 1) * 3;

        return new Date(year, month, 1);

    }

});
