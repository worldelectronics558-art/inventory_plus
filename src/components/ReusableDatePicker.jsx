
// src/components/ReusableDatePicker.jsx

import React, { useState, useRef, useEffect } from "react";
import { DateRangePicker } from 'react-date-range';

// Import the required CSS
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file

import { Calendar, ChevronDown } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, startOfYear } from "date-fns";
import { createStaticRanges } from 'react-date-range';

// Define the static ranges in the format the library expects
const staticRanges = createStaticRanges([
  {
    label: 'Today',
    range: () => ({ startDate: startOfDay(new Date()), endDate: endOfDay(new Date()) }),
  },
  {
    label: 'Yesterday',
    range: () => ({ startDate: startOfDay(subDays(new Date(), 1)), endDate: endOfDay(subDays(new Date(), 1)) }),
  },
  {
    label: 'Last 7 Days',
    range: () => ({ startDate: startOfDay(subDays(new Date(), 6)), endDate: endOfDay(new Date()) }),
  },
  {
    label: 'Last 30 Days',
    range: () => ({ startDate: startOfDay(subDays(new Date(), 29)), endDate: endOfDay(new Date()) }),
  },
  {
    label: 'Month to date',
    range: () => ({ startDate: startOfMonth(new Date()), endDate: endOfDay(new Date()) }),
  },
  {
    label: 'Year to date',
    range: () => ({ startDate: startOfYear(new Date()), endDate: endOfDay(new Date()) }),
  },
]);

const ReusableDatePicker = ({ dateRange, setDateRange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const [startDate, endDate] = dateRange || [null, null];

  // The state for react-date-range needs a specific format
  const pickerDateRange = {
    startDate: startDate || new Date(),
    endDate: endDate || new Date(),
    key: 'selection',
  };

  const handleSelect = (ranges) => {
    const { selection } = ranges;
    // Ensure we set the time correctly for the end date for accurate filtering
    setDateRange([selection.startDate, endOfDay(selection.endDate)]);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const displayFormat = "MMM d, yyyy";
  const displayValue = startDate && endDate
      ? `${format(startDate, displayFormat)} - ${format(endDate, displayFormat)}`
      : "Select Date Range";

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* This is the button that the user clicks */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="input-base flex items-center justify-between w-full"
      >
        <span className="flex items-center">
          <Calendar size={20} className="mr-2 text-gray-400" />
          {displayValue}
        </span>
        <ChevronDown size={20} className="text-gray-400" />
      </button>

      {/* This is the dropdown with the calendar */}
      {isOpen && (
        <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg right-0 lg:left-0">
            <DateRangePicker
                onChange={handleSelect}
                showSelectionPreview={true}
                moveRangeOnFirstSelection={false}
                months={1} // As requested, show only one month
                ranges={[pickerDateRange]}
                direction="horizontal"
                staticRanges={staticRanges}
                inputRanges={[]} // We don't need the manual text input ranges at the bottom
            />
        </div>
      )}
    </div>
  );
};

export default ReusableDatePicker;
