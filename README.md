# PYFUEL
Pyfuel is a complete management system for your private fuel dispensing systems, such as fleet depots or even smaller organizations that need accurate and orderly management of dispensing and the data that derives from it.
By complete management system we mean that:
Pyfuel is a software for high-performance electronic boards such as Raspberry Pi, which allows you to manage the various mechanical equipment that concern the physical dispensing system, such as the dispensing pump, the pulser for counting the liters, the dispensing nozzles, solenoid valves and more.

The Pyfuel software includes intuitive graphics that also allow users who are less familiar with automatic and self-service systems to be able to refuel independently with the use of a personal card that will be enabled and monitored by the owner. It is possible to insert the Pyfuel system in two different modes, 
Self:
    in order to dispense, users must necessarily bring their personal card close to the RFID reader provided with the Rasp. Plus, and if the card has been previously registered, it will be possible to dispense by selecting the desired nozzle 
    (with a simple click), it is possible to add additional checks in addition to the simple validation of the card, such as the verification of a vehicle and the total kilometers of a vehicle associated with the user who wants to dispense,
    or a PIN code.
Manual mode:
allows you to dispense freely without card checks or validations.

The two modes are mainly distinguished by the color of the buttons:
Green button, Self mode.
Gray button, manual mode.

following a card validation and related checks, the button will turn Yellow, Waiting to be clicked, and a text in the center of the screen will indicate to the user the action to be performed with a message similar to "SELECT SIDE", if this text is not present in the center of the screen, but rather the item "APPROVE CARD", then the Yellow side has already been selected by a user.
It is my duty to remind you that this information is purely informative, as even without reading it, the Pyfuel system is intuitive and simple as already reiterated, all the functions listed above have a timer (e.g. side selection) within which to perform a certain action, after which the system returns to the initial state of waiting for delivery, in this way even if a user forgets or makes a mistake in an action, the system cancels the actions if it does not find any interaction.
