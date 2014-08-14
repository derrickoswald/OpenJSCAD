GreeterTest = TestCase("HelloTest");

function read_records ()
{
    var url;
    var xmlhttp;
    var ret = "";

    url = "/things/_design/things/_view/OverView";
    xmlhttp = new XMLHttpRequest ();
    xmlhttp.open ("GET", url, false);
    xmlhttp.onreadystatechange = function ()
    {
        if ((4 == xmlhttp.readyState) && (200 == xmlhttp.status))
        {
            ret = xmlhttp.responseText;
        }
    };
    xmlhttp.send ();
    
    return (ret);
}

GreeterTest.prototype.testGreet = function ()
{
    var greeter = new myapp.Greeter ();
    assertEquals ("Hello World!", greeter.greet ("World"));
  
    assertNotSame ("page not found", "", read_records ());
};