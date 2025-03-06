import React, { useState, useEffect } from "react";
import axios from "axios";
import baseUrl from "../URL";
import { toast } from "react-toastify";

const Settings = () => {
  const [minute, setMinute] = useState("*");
  const [hour, setHour] = useState("*");
  const [day, setDay] = useState("*");
  const [month, setMonth] = useState("*");
  const [weekday, setWeekday] = useState("*");
  const [loading, setLoading] = useState(false);

  // Fetch the current cron schedule from the backend
  const fetchCronSchedule = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${baseUrl}/cron-schedule`, { withCredentials: true });
      const cronParts = response.data.cronSchedule.split(" ");
      setMinute(cronParts[0] || "*");
      setHour(cronParts[1] || "*");
      setDay(cronParts[2] || "*");
      setMonth(cronParts[3] || "*");
      setWeekday(cronParts[4] || "*");
    } catch (error) {
      toast.error("Failed to fetch schedule.");
      console.error(error);
    }
    setLoading(false);
  };

  // Update the cron schedule in the backend
  const updateCronSchedule = async () => {
    const cronExpression = `${minute} ${hour} ${day} ${month} ${weekday}`;
    
    setLoading(true);
    try {
      await axios.put(
        `${baseUrl}/cron-update`,
        { cronSchedule: cronExpression },
        { withCredentials: true }
      );
      toast.success("Schedule updated successfully!");
    } catch (error) {
      toast.error("Error updating schedule. Invalid cron schedule.");
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCronSchedule();
  }, []);

  // Function to generate options for dropdowns
  const generateOptions = (start, end) => {
    return Array.from({ length: end - start + 1 }, (_, i) => i + start).map((num) => (
      <option key={num} value={num}>{num}</option>
    ));
  };

  return (
    <div className="bg-cover h-[100vh] flex items-center  bg-center" style={{ backgroundImage: "url('./landingpage2.png')" }}> 
    <div className=" sm:w-1/2 mx-auto bg-gray-300 opacity-85 shadow-lg rounded-xl p-6  ">
      {/* <ToastContainer position="down-right" className="" autoClose={3000} /> */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">Daily Schedule Settings</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Minute */}
        <div>
          <label className="block text-sky-700 mb-1">Minute</label>
          <select value={minute} onChange={(e) => setMinute(e.target.value)} className="w-full p-2 border rounded-lg">
            <option value="*">Every Minute</option>
            {generateOptions(0, 59)}
          </select>
        </div>

        {/* Hour */}
        <div>
          <label className="block text-sky-700 mb-1">Hour</label>
          <select value={hour} onChange={(e) => setHour(e.target.value)} className="w-full p-2 border rounded-lg">
            <option value="*">Every Hour</option>
            {generateOptions(0, 23)}
          </select>
        </div>

        {/* Day of Month */}
        <div>
          <label className="block text-sky-700 mb-1">Day of Month</label>
          <select value={day} onChange={(e) => setDay(e.target.value)} className="w-full p-2 border rounded-lg">
            <option value="*">Every Day</option>
            {generateOptions(1, 31)}
          </select>
        </div>

        {/* Month */}
        <div>
          <label className="block text-sky-700 mb-1">Month</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full p-2 border rounded-lg">
            <option value="*">Every Month</option>
            {generateOptions(1, 12)}
          </select>
        </div>

        {/* Day of the Week */}
        <div className="col-span-2">
          <label className="block text-sky-700 mb-1">Day of the Week</label>
          <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className="w-full p-2 border rounded-lg">
            <option value="*">Every Day</option>
            <option value="0">Sunday</option>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
          </select>
        </div>
      </div>

      {/* Update Button */}
      <button
        onClick={updateCronSchedule}
        className="relative inline-flex mt-5 items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-cyan-500 to-blue-500 group-hover:from-cyan-500 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-cyan-200 dark:focus:ring-cyan-800"
        disabled={loading}
      >
              <span class="relative px-5 py-2.5 transition-all ease-in duration-75 bg-white dark:bg-gray-900 rounded-md group-hover:bg-transparent group-hover:dark:bg-transparent">
                    {loading ? "Updating..." : "Update Schedule"}
                    </span>
      </button>
     
    </div>
    </div>
  );
};

export default Settings;
