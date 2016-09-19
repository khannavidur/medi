/*
    Function to generate Pie Chart
*/
var populate_chart =function (data){
    var pieData = [{
                value : parseFloat(data.anger)||0,
                color : "#F7525F",
                label : 'Anger',
                labelColor : 'white',
                labelFontSize : '16'
            },
                  {
                value : parseFloat(data.disgust)||0,
                color : "#3ACEBF",
                label : 'Disgust',
                labelColor : 'white',
                labelFontSize : '16'
            },
            
            {
                value :parseFloat(data.fear)||0,
                color : "#1B223A",
                label : 'Fear',
                labelColor : 'white',
                labelFontSize : '16'
            },
                  {
                value : parseFloat(data.joy)||0,
                color : "#8BC34A",
                label : 'Joy',
                labelColor : 'white',
                labelFontSize : '16'
            },
             {
                value : parseFloat(data.sadness)||0,
                color : "#F38630",
                label : 'Sadness',
                labelColor : 'white',
                labelFontSize : '16'
            }];

        console.log(pieData);
        var myPie = new Chart(document.getElementById("canvas").getContext("2d")).Pie(pieData, { 		               
            animationSteps: 100,
     		animationEasing: 'easeInOutQuart'	
        });
}
