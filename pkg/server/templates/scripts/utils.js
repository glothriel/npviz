function isSubset(smallerSet, biggerSet) {
    return _.every(
        smallerSet,
        function (value, key) {
            return biggerSet[key] == value
        }
    )
}