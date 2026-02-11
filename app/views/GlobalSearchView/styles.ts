import { StyleSheet } from 'react-native';

import sharedStyles from '../Styles';

export default StyleSheet.create({
    searchContainer: {
        padding: 20,
        paddingBottom: 0
    },
    list: {
        flex: 1
    },
    divider: {
        width: '100%',
        height: StyleSheet.hairlineWidth,
        marginVertical: 12
    },
    listEmptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 40
    },
    noDataFound: {
        fontSize: 14,
        ...sharedStyles.textRegular
    },
    resultItem: {
        paddingHorizontal: 16,
        paddingVertical: 12
    },
    resultItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4
    },
    roomName: {
        fontSize: 13,
        marginLeft: 4,
        flex: 1,
        ...sharedStyles.textMedium
    },
    timestamp: {
        fontSize: 12,
        marginLeft: 8,
        ...sharedStyles.textRegular
    },
    senderName: {
        fontSize: 13,
        marginBottom: 2,
        ...sharedStyles.textSemibold
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20,
        ...sharedStyles.textRegular
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 16
    }
});
